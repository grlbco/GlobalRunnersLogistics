import "server-only";
import { adminDb } from "./admin";
import { activity, contactByPhone, createInboundContact, moveStage, recordMessage } from "./ingest";
import { phoneDisplay } from "./format";
import * as quo from "@/lib/integrations/quo";
import { siteUrl } from "@/lib/site";

const MISSED = new Set(["missed", "no-answer", "abandoned", "busy", "canceled"]);
const mmss = (s: number) => `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
export const isMissed = (c: Pick<quo.QuoCall, "direction" | "status" | "answeredAt" | "duration">) =>
  c.direction === "incoming" && (MISSED.has(c.status) || (c.status === "completed" && !c.answeredAt && !c.duration));

function bodyFor(c: quo.QuoCall) {
  const missed = isMissed(c);
  const head = c.direction === "incoming" ? (missed ? "Missed call" : `Call from driver · ${mmss(c.duration)}`) : c.answeredAt ? `Call to driver · ${mmss(c.duration)}` : "Call to driver · no answer";
  const vm = c.voicemail?.transcript ? `\nVoicemail: "${c.voicemail.transcript.trim()}"` : c.voicemail ? "\nLeft a voicemail" : "";
  const sum = c.summary?.status === "completed" && c.summary.summary?.length ? `\nSummary: ${c.summary.summary.join(" ")}${c.summary.nextSteps?.length ? `\nNext: ${c.summary.nextSteps.join(" ")}` : ""}` : "";
  return head + vm + sum;
}

/**
 * One Quo call → the driver's timeline. Idempotent: runs on every sync/webhook and only
 * acts once per call for each side effect (missed-call text, summary → memory).
 */
export async function ingestQuoCall(c: quo.QuoCall): Promise<"new" | "updated" | "skipped"> {
  if (["queued", "initiated", "ringing", "in-progress"].includes(c.status)) return "skipped";
  const ours = quo.fromNumber();
  const other = c.participants.find((p) => p.phoneNumber !== ours && /^\+\d{8,15}$/.test(p.phoneNumber))?.phoneNumber;
  if (!other || other === process.env.NOTIFY_SMS_TO) return "skipped";
  const db = adminDb();
  let contact = await contactByPhone(other);
  if (!contact) {
    if (c.direction !== "incoming") return "skipped";
    contact = await createInboundContact({ phone: other, source: "inbound_call" });
  }
  const missed = isMissed(c);
  const body = bodyFor(c);
  const meta = { duration: c.duration, status: c.status, answered: !!c.answeredAt, missed, ai: c.aiHandled, voicemail: c.voicemail?.recordingUrl ?? null, summary_done: c.summary?.status === "completed" };

  const { data: existing } = await db.from("messages").select("id, meta, body").eq("channel", "call").eq("external_id", c.id).maybeSingle();
  if (existing) {
    const old = (existing.meta ?? {}) as { summary_done?: boolean };
    if (existing.body === body && old.summary_done === meta.summary_done) return "skipped";
    await db.from("messages").update({ body, meta: { ...old, ...meta } }).eq("id", existing.id);
    if (meta.summary_done && !old.summary_done) await saveSummary(contact.id, c);
    return "updated";
  }

  await recordMessage({
    contactId: contact.id, channel: "call", direction: c.direction === "incoming" ? "inbound" : "outbound",
    author: c.direction === "incoming" ? "lead" : "human", body, externalId: c.id, at: c.createdAt, status: c.direction === "incoming" ? "received" : "sent", meta,
  });
  await activity(contact.id, missed ? "call_missed" : "call", { direction: c.direction, duration: c.duration }, "quo");

  const fresh = Date.now() - new Date(c.createdAt).getTime() < 30 * 60_000;
  if (c.answeredAt && !c.aiHandled) {
    // a person talked to the driver: the assistant steps back and the card moves on
    const { pauseAssistantForHuman } = await import("./outbox");
    await pauseAssistantForHuman(contact.id, 4);
    await moveStage(contact, "interested", "quo");
  }
  if (meta.summary_done) await saveSummary(contact.id, c);

  if (missed && fresh) {
    // calling us = consent to answer them by text (same rule as texting us first)
    if (!contact.sms_consent) await db.from("contacts").update({ sms_consent: true, sms_consent_source: "called us" }).eq("id", contact.id);
    const { count } = await db.from("outbox").select("*", { count: "exact", head: true }).eq("contact_id", contact.id).eq("channel", "sms").gte("created_at", new Date(Date.now() - 30 * 60_000).toISOString());
    if (!count && !contact.do_not_contact) {
      const name = contact.first_name ? ` ${contact.first_name}` : "";
      await db.from("outbox").insert({
        contact_id: contact.id, channel: "sms", author: "workflow", status: "pending", is_reply: true, send_after: new Date(Date.now() + 45_000).toISOString(),
        body: `Hey${name}, sorry we missed your call. This is Ken's team at Global Runners. Text back a good time and Ken will call you, or just text your question here.`,
      });
    }
    await db.from("tasks").insert({ contact_id: contact.id, title: `Call back: missed call from ${contact.first_name ?? phoneDisplay(other)}`, due_at: new Date().toISOString(), created_by: "workflow" });
    const { sendTelegram, esc } = await import("@/lib/integrations/telegram");
    await sendTelegram(`📵 <b>Missed call</b> from ${esc(contact.first_name ?? "a driver")} <a href="tel:${other}">${esc(phoneDisplay(other))}</a>${c.voicemail?.transcript ? `\nVoicemail: "${esc(c.voicemail.transcript.slice(0, 500))}"` : ""}\nWe texted them back.\n\n<a href="${siteUrl()}/crm/contacts/${contact.id}">Open in GRL Command</a>`);
    const { emit } = await import("@/lib/automations/engine");
    await emit("call_missed", contact.id, {});
  }
  return "new";
}

/** Quo's AI call summary → note + the assistant's memory. */
async function saveSummary(contactId: string, c: quo.QuoCall) {
  if (c.summary?.status !== "completed" || !c.summary.summary?.length) return;
  const db = adminDb();
  const text = c.summary.summary.join(" ");
  const when = new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  await db.from("notes").insert({ contact_id: contactId, author_kind: "system", body: `Call summary (${when}, ${mmss(c.duration)}):\n${text}${c.summary.nextSteps?.length ? `\nNext steps: ${c.summary.nextSteps.join(" ")}` : ""}` });
  const { data: mem } = await db.from("agent_memory").select("summary").eq("contact_id", contactId).maybeSingle();
  const merged = `${mem?.summary ? `${mem.summary} ` : ""}Phone call ${when}: ${text}`.slice(-1500);
  await db.from("agent_memory").upsert({ contact_id: contactId, summary: merged, updated_at: new Date().toISOString() });
}

/** Pull calls from Quo (dev and backup for webhooks). Looks back 3h so summaries that finish later get picked up. */
export async function syncQuoCalls(): Promise<{ calls: number; changed: number }> {
  const since = new Date(Date.now() - 3 * 3600_000).toISOString();
  const calls = await quo.callsSince(since);
  let changed = 0;
  for (const c of calls.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) if ((await ingestQuoCall(c)) !== "skipped") changed++;
  return { calls: calls.length, changed };
}
