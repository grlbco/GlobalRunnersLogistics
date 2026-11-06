import "server-only";
import { adminDb } from "@/lib/crm/admin";
import { activity } from "@/lib/crm/ingest";
import { notifyTeam } from "@/lib/crm/notify";
import { getAssistantSettings } from "@/lib/crm/settings";
import { esc, sendTelegram } from "@/lib/integrations/telegram";
import { company } from "@/content/facts";
import { HOLDING_TEXT, REPLY_WINDOW_MS_FOR_HOLD, needsRescue } from "./recovery";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || company.url;
const STUCK_MS = 10 * 60_000;

/**
 * The assistant couldn't answer: a person gets a task and an alert, and a recent message gets a holding text.
 * No AI is involved, so this still works when the AI is down. Never throws.
 */
export async function escalateToPerson(contactId: string, reason: string) {
  const db = adminDb();
  try {
    const { data: c } = await db.from("contacts").select("first_name, last_name").eq("id", contactId).single();
    const name = [c?.first_name, c?.last_name].filter(Boolean).join(" ") || "driver";
    const { count: open } = await db.from("tasks").select("*", { count: "exact", head: true }).eq("contact_id", contactId).is("done_at", null).like("title", "Driver waiting%");
    if (open) return;
    await db.from("tasks").insert({ contact_id: contactId, title: `Driver waiting on a reply: ${name}`.slice(0, 300), created_by: "agent", due_at: new Date().toISOString() });
    await activity(contactId, "escalated_to_person", { reason: reason.slice(0, 300) }, "system");

    const { data: last } = await db.from("messages").select("channel, created_at").eq("contact_id", contactId).eq("direction", "inbound").neq("channel", "call").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (last && Date.now() - new Date(last.created_at).getTime() < REPLY_WINDOW_MS_FOR_HOLD) {
      const settings = await getAssistantSettings();
      await db.from("outbox").insert({ contact_id: contactId, channel: last.channel, author: "agent", body: HOLDING_TEXT, status: settings.draft_mode ? "draft" : "pending", send_after: new Date().toISOString(), is_reply: true });
    }

    const link = `${siteUrl()}/crm/contacts/${contactId}`;
    await Promise.allSettled([
      notifyTeam(`Driver waiting on a reply: ${name}`, `${reason}\n\nOpen: ${link}`),
      sendTelegram(`⚠️ <b>Driver waiting on a reply</b>\n<b>${esc(name)}</b>\n${esc(reason.slice(0, 300))}\n\n<a href="${link}">Open in GRL Command</a>`),
    ]);
  } catch (e) {
    console.error("escalateToPerson failed", contactId, e);
  }
}

/** Safety net on every tick: catches what fell through, whatever the cause. */
export async function sweepStuck() {
  const db = adminDb();
  const now = new Date();
  const stuckBefore = new Date(now.getTime() - STUCK_MS).toISOString();

  // Runs a crashed worker left behind.
  const { data: runs } = await db.from("agent_runs").update({ action: "failed", decision: { error: "worker stopped during this run" } }).eq("action", "running").lt("created_at", stuckBefore).select("id");
  // A crash mid-send may or may not have delivered, so never resend automatically: show it to a person.
  const { data: sends } = await db.from("outbox").update({ status: "failed", error: "Send was interrupted: check before resending" }).eq("status", "sending").lt("send_after", stuckBefore).select("id");

  const { data: contacts } = await db
    .from("contacts")
    .select("id, last_inbound_at, last_outbound_at")
    .eq("do_not_contact", false)
    .not("last_inbound_at", "is", null)
    .lt("last_inbound_at", new Date(now.getTime() - 15 * 60_000).toISOString())
    .gt("last_inbound_at", new Date(now.getTime() - 7 * 86400_000).toISOString())
    .order("last_inbound_at", { ascending: false })
    .limit(50);

  let rescued = 0;
  for (const c of contacts ?? []) {
    const inboundAt = c.last_inbound_at as string;
    if (c.last_outbound_at && c.last_outbound_at >= inboundAt) continue;
    const [{ count: outgoing }, { count: queued }, { count: tasks }, { data: run }, { data: msg }] = await Promise.all([
      db.from("outbox").select("*", { count: "exact", head: true }).eq("contact_id", c.id).in("status", ["draft", "pending", "sending"]),
      db.from("agent_runs").select("*", { count: "exact", head: true }).eq("contact_id", c.id).in("action", ["queued", "running"]),
      db.from("tasks").select("*", { count: "exact", head: true }).eq("contact_id", c.id).gte("created_at", inboundAt),
      db.from("agent_runs").select("action").eq("contact_id", c.id).gte("created_at", inboundAt).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      db.from("messages").select("meta").eq("contact_id", c.id).eq("direction", "inbound").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const due = needsRescue({
      lastInboundAt: inboundAt, lastOutboundAt: c.last_outbound_at, now,
      waiting: !!(outgoing || queued), taskSinceInbound: !!tasks, lastRunAction: run?.action ?? null,
      autoReply: !!(msg?.meta as { auto_reply?: boolean } | null)?.auto_reply,
    });
    if (due) {
      await escalateToPerson(c.id, "No reply went out and nobody was told, so this was caught by the safety check.");
      rescued++;
    }
  }
  return { rescued, staleRuns: runs?.length ?? 0, interruptedSends: sends?.length ?? 0 };
}
