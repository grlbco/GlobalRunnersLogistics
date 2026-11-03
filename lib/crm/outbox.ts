import "server-only";
import { adminDb } from "./admin";
import { isSuppressed, recordMessage } from "./ingest";
import * as quo from "@/lib/integrations/quo";
import * as instantly from "@/lib/integrations/instantly";

/**
 * The only place that sends. Every check runs here right before the API call:
 * kill switch, do-not-contact, suppression list, consent, quiet hours (automatic sends), thread availability.
 */
export const sendingEnabled = () => process.env.SENDING_ENABLED === "true";

type Row = { id: string; contact_id: string; channel: "email" | "sms"; author: "agent" | "human" | "workflow"; author_id: string | null; subject: string | null; body: string; attempts: number };

function inQuietHours(tz: string | null, at = new Date()) {
  if (!tz) return false;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false, weekday: "short" }).formatToParts(at);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 12) % 24;
  const day = parts.find((p) => p.type === "weekday")?.value;
  return hour < 9 || hour >= 20 || day === "Sun";
}

export type SendOutcome = { ok: true; messageId: string | null } | { ok: false; reason: string; retry?: boolean };

async function sendOne(row: Row): Promise<SendOutcome> {
  const db = adminDb();
  if (!sendingEnabled()) return { ok: false, reason: "Sending is switched off (SENDING_ENABLED=false)" };
  const { data: c } = await db.from("contacts").select("id, email, phone, cell_phone, timezone, do_not_contact, email_consent, sms_consent").eq("id", row.contact_id).single();
  if (!c) return { ok: false, reason: "Contact not found" };
  if (c.do_not_contact) return { ok: false, reason: "Contact is do-not-contact" };
  if (row.author !== "human" && inQuietHours(c.timezone)) return { ok: false, reason: "Quiet hours in the driver's time zone", retry: true };

  if (row.channel === "sms") {
    const to = c.cell_phone ?? c.phone;
    if (!c.sms_consent) return { ok: false, reason: "No text consent yet (driver must text us first or tick the form box)" };
    if (await isSuppressed("sms", to)) return { ok: false, reason: "Number is on the opt-out list" };
    const r = await quo.sendText(to!, row.body);
    const messageId = await recordMessage({ contactId: c.id, channel: "sms", direction: "outbound", author: row.author === "workflow" ? "system" : row.author, authorId: row.author_id, body: row.body, externalId: r.id ?? null, status: "sent" });
    return { ok: true, messageId };
  }

  if (!c.email_consent) return { ok: false, reason: "Email is off for this contact (unsubscribed)" };
  if (await isSuppressed("email", c.email)) return { ok: false, reason: "Email is on the opt-out list" };
  // Replies go in the existing Instantly thread from the inbox that's talking to the driver.
  const { data: last } = await db
    .from("messages")
    .select("external_id, subject, meta")
    .eq("contact_id", c.id).eq("channel", "email").not("external_id", "is", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const eaccount = (last?.meta as { eaccount?: string } | null)?.eaccount;
  if (!last?.external_id || !eaccount) return { ok: false, reason: "No email thread yet: the first email comes from a campaign" };
  const r = await instantly.replyToEmail({ eaccount, replyToUuid: last.external_id, subject: row.subject ?? last.subject ?? "Driving with Global Runners", text: row.body });
  const messageId = await recordMessage({ contactId: c.id, channel: "email", direction: "outbound", author: row.author === "workflow" ? "system" : row.author, authorId: row.author_id, subject: row.subject ?? last.subject, body: row.body, externalId: r.id ?? null, meta: { eaccount }, status: "sent" });
  return { ok: true, messageId };
}

/** Claims and sends one outbox row. */
export async function processRow(id: string): Promise<SendOutcome> {
  const db = adminDb();
  const { data: row } = await db.from("outbox").update({ status: "sending" }).eq("id", id).eq("status", "pending").select("id, contact_id, channel, author, author_id, subject, body, attempts").maybeSingle();
  if (!row) return { ok: false, reason: "Already sent or cancelled" };
  try {
    const out = await sendOne(row as Row);
    if (out.ok) await db.from("outbox").update({ status: "sent", message_id: out.messageId, attempts: row.attempts + 1 }).eq("id", id);
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
  const { data } = await adminDb().from("outbox").select("id").eq("status", "pending").lte("send_after", new Date().toISOString()).order("send_after").limit(limit);
  const results = [];
  for (const r of data ?? []) results.push({ id: r.id, ...(await processRow(r.id)) });
  return results;
}
