import "server-only";
import { adminDb } from "./admin";
import { isSuppressed, recordMessage } from "./ingest";
import * as quo from "@/lib/integrations/quo";
import * as instantly from "@/lib/integrations/instantly";

/**
 * The only place that sends. Every check runs here right before the API call:
 * kill switch, do-not-contact, suppression list, consent, quiet hours (automatic sends), thread availability.
 */
import { isSendingOn } from "./sending";
import { gate } from "./sendGate";
export { inQuietHours } from "./sendGate";
/** @deprecated use isSendingOn() (env + CRM switch). */
export const sendingEnabled = () => process.env.SENDING_ENABLED === "true";

type Row = { id: string; contact_id: string; channel: "email" | "sms"; author: "agent" | "human" | "workflow"; author_id: string | null; subject: string | null; body: string; attempts: number; is_reply: boolean; created_at: string };

export type SendOutcome = { ok: true; messageId: string | null } | { ok: false; reason: string; retry?: boolean; cancel?: boolean };

async function sendOne(row: Row): Promise<SendOutcome> {
  const db = adminDb();
  if (!(await isSendingOn())) return { ok: false, reason: "Sending is switched off (Settings → All sending, or SENDING_ENABLED)", retry: true };
  const { data: c } = await db.from("contacts").select("id, email, phone, cell_phone, timezone, do_not_contact, email_consent, sms_consent, agent_mode, agent_paused_until, last_inbound_at").eq("id", row.contact_id).single();
  if (!c) return { ok: false, reason: "Contact not found" };
  const to = c.cell_phone ?? c.phone;
  const { count: recentTexts } = row.channel === "sms"
    ? await db.from("messages").select("*", { count: "exact", head: true }).eq("contact_id", c.id).eq("channel", "sms").eq("direction", "outbound").neq("author", "human").gte("created_at", new Date(Date.now() - 86400_000).toISOString())
    : { count: 0 };
  const { data: lastIn } = await db.from("messages").select("channel").eq("contact_id", c.id).eq("direction", "inbound").neq("channel", "call").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const verdict = gate({
    channel: row.channel, author: row.author, approvedByPerson: !!row.author_id, isReply: row.is_reply, createdAt: row.created_at,
    contact: { doNotContact: c.do_not_contact, emailConsent: c.email_consent, smsConsent: c.sms_consent, email: c.email, phone: to, timezone: c.timezone, agentMode: c.agent_mode, pausedUntil: c.agent_paused_until },
    suppressed: await isSuppressed(row.channel, row.channel === "sms" ? to : c.email),
    lastInboundAt: c.last_inbound_at, lastInboundChannel: lastIn?.channel ?? null, proactiveTexts24h: recentTexts ?? 0, now: new Date(),
  });
  if (verdict.action === "wait") return { ok: false, reason: verdict.reason, retry: true };
  if (verdict.action === "cancel") return { ok: false, reason: verdict.reason, cancel: true };
  if (verdict.action === "fail") return { ok: false, reason: verdict.reason };

  if (row.channel === "sms") {
    const r = await quo.sendText(to!, row.body);
    const messageId = await recordMessage({ contactId: c.id, channel: "sms", direction: "outbound", author: row.author === "workflow" ? "system" : row.author, authorId: row.author_id, body: row.body, externalId: r.id ?? null, status: "sent" });
    return { ok: true, messageId };
  }

  // Replies go in the existing Instantly thread from the inbox that's talking to the driver.
  const { data: last } = await db
    .from("messages")
    .select("external_id, subject, meta")
    .eq("contact_id", c.id).eq("channel", "email").not("external_id", "is", null).not("meta->>eaccount", "is", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const eaccount = (last?.meta as { eaccount?: string } | null)?.eaccount;
  if (!last?.external_id || !eaccount) {
    // no campaign thread (driver came by text, website or a form): send directly through Resend
    const { resendConfigured, sendDirectEmail } = await import("@/lib/integrations/resend");
    if (!c.email) return { ok: false, reason: "No email address" };
    if (!resendConfigured()) return { ok: false, reason: "No email thread yet and Resend isn't set up" };
    // Direct email only to people who engaged with us. Cold leads are emailed by Instantly campaigns, never from our main domain.
    const { count: engaged } = await db.from("messages").select("*", { count: "exact", head: true }).eq("contact_id", c.id).eq("direction", "inbound");
    const { data: src } = await db.from("contacts").select("source").eq("id", c.id).single();
    if (!engaged && (!src?.source || src.source === "toss_import" || src.source === "manual")) return { ok: false, reason: "Never wrote to us: cold leads get email only through an Instantly campaign" };
    const { data: prev } = await db.from("messages").select("subject").eq("contact_id", c.id).eq("channel", "email").not("subject", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const subject = row.subject ?? (prev?.subject ? (/^re:/i.test(prev.subject) ? prev.subject : `Re: ${prev.subject}`) : "Driving with Global Runners");
    const r = await sendDirectEmail({ to: c.email, subject, text: row.body });
    const messageId = await recordMessage({ contactId: c.id, channel: "email", direction: "outbound", author: row.author === "workflow" ? "system" : row.author, authorId: row.author_id, subject, body: row.body, externalId: r.id ? `resend:${r.id}` : null, meta: { via: "resend" }, status: "sent" });
    return { ok: true, messageId };
  }
  const r = await instantly.replyToEmail({ eaccount, replyToUuid: last.external_id, subject: row.subject ?? last.subject ?? "Driving with Global Runners", text: row.body });
  const messageId = await recordMessage({ contactId: c.id, channel: "email", direction: "outbound", author: row.author === "workflow" ? "system" : row.author, authorId: row.author_id, subject: row.subject ?? last.subject, body: row.body, externalId: r.id ?? null, meta: { eaccount }, status: "sent" });
  return { ok: true, messageId };
}

/** Claims and sends one outbox row. */
/** A person wrote to the driver: the assistant stops until someone hands back, so nobody talks over each other. */
export async function pauseAssistantForHuman(contactId: string) {
  const db = adminDb();
  await db.from("contacts").update({ agent_mode: "manual" }).eq("id", contactId);
  await db.from("outbox").update({ status: "cancelled", error: "a person replied" }).eq("contact_id", contactId).eq("author", "agent").in("status", ["draft", "pending"]);
}

export async function processRow(id: string): Promise<SendOutcome> {
  const db = adminDb();
  const { data: row } = await db.from("outbox").update({ status: "sending" }).eq("id", id).eq("status", "pending").select("id, contact_id, channel, author, author_id, subject, body, attempts, is_reply, created_at").maybeSingle();
  if (!row) return { ok: false, reason: "Already sent or cancelled" };
  try {
    const out = await sendOne(row as Row);
    if (out.ok) {
      await db.from("outbox").update({ status: "sent", message_id: out.messageId, attempts: row.attempts + 1 }).eq("id", id);
      if (row.author === "human") await pauseAssistantForHuman(row.contact_id);
    }
    else if (out.cancel) await db.from("outbox").update({ status: "cancelled", error: out.reason }).eq("id", id);
    else if (out.retry) await db.from("outbox").update({ status: "pending", send_after: new Date(Date.now() + 30 * 60_000).toISOString(), error: out.reason }).eq("id", id);
    else await db.from("outbox").update({ status: "failed", error: out.reason, attempts: row.attempts + 1 }).eq("id", id);
    return out;
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    await db.from("outbox").update({ status: "failed", error: reason.slice(0, 500), attempts: row.attempts + 1 }).eq("id", id);
    return { ok: false, reason };
  }
}

export async function processDue(limit = 20) {
  if (!(await isSendingOn())) return []; // everything waits while sending is off
  const { data } = await adminDb().from("outbox").select("id").eq("status", "pending").lte("send_after", new Date().toISOString()).order("send_after").limit(limit);
  const results = [];
  for (const r of data ?? []) results.push({ id: r.id, ...(await processRow(r.id)) });
  return results;
}
