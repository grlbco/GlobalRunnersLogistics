import "server-only";
import { adminDb } from "./admin";
import type { Stage } from "./stages";

/**
 * Everything that enters the CRM from Instantly, Quo or the website goes through here,
 * so a message is stored once (unique external id) and stage moves stay forward-only.
 */
const RANK: Record<Stage, number> = {
  new: 0, contacted: 1, replied: 2, interested: 3, form_sent: 4, applied: 5, qualified: 6, sent_to_ken: 7, hired: 8,
  nurture: 2, not_fit: 9, not_interested: 9, unsubscribed: 10, bounced: 10,
};
const TERMINAL = new Set<Stage>(["hired", "not_fit", "unsubscribed", "bounced"]);

/** Automatic moves only go forward; opt-out/bounce always win. Humans can move anywhere (via the UI). */
export function advance(current: Stage, next: Stage): Stage {
  if (next === "unsubscribed" || next === "bounced") return next;
  if (TERMINAL.has(current)) return current;
  return RANK[next] > RANK[current] ? next : current;
}

export type Contact = { id: string; stage: Stage; email: string | null; phone: string | null; cell_phone: string | null; do_not_contact: boolean; sms_consent: boolean; agent_mode: string; first_name: string | null };
const COLS = "id, stage, email, phone, cell_phone, do_not_contact, sms_consent, agent_mode, first_name";

export async function contactByEmail(email: string): Promise<Contact | null> {
  const { data } = await adminDb().from("contacts").select(COLS).eq("email", email.toLowerCase()).maybeSingle();
  return data as Contact | null;
}

export async function contactByPhone(phone: string): Promise<Contact | null> {
  const { data } = await adminDb().from("contacts").select(COLS).or(`phone.eq.${phone},cell_phone.eq.${phone}`).limit(1).maybeSingle();
  return data as Contact | null;
}

export async function createInboundContact(p: { email?: string; phone?: string; source: string }): Promise<Contact> {
  const { data, error } = await adminDb()
    .from("contacts")
    .insert({ email: p.email?.toLowerCase() ?? null, cell_phone: p.phone ?? null, source: p.source, stage: "replied", tags: ["inbound"] })
    .select(COLS)
    .single();
  if (error) throw error;
  return data as Contact;
}

export async function moveStage(contact: Contact, next: Stage, actor = "system", extra: Record<string, unknown> = {}) {
  const to = advance(contact.stage, next);
  const patch: Record<string, unknown> = { ...extra };
  if (to !== contact.stage) Object.assign(patch, { stage: to, stage_changed_at: new Date().toISOString() });
  if (Object.keys(patch).length) await adminDb().from("contacts").update(patch).eq("id", contact.id);
  if (to !== contact.stage) {
    await adminDb().from("activities").insert({ contact_id: contact.id, type: "stage_changed", data: { from: contact.stage, to }, actor });
  }
  return { ...contact, ...patch, stage: to } as Contact;
}

export async function activity(contactId: string, type: string, data: Record<string, unknown> = {}, actor = "system") {
  await adminDb().from("activities").insert({ contact_id: contactId, type, data, actor });
}

export async function logEvent(source: "instantly" | "quo" | "website" | "system", type: string, payload: unknown, contactId?: string | null, externalId?: string | null) {
  await adminDb().from("events").insert({ source, type, payload, contact_id: contactId ?? null, external_id: externalId ?? null, processed_at: new Date().toISOString() });
}

async function conversationFor(contactId: string, channel: "email" | "sms" | "call", externalId?: string | null) {
  const db = adminDb();
  if (externalId) {
    const { data } = await db.from("conversations").select("id").eq("channel", channel).eq("external_id", externalId).maybeSingle();
    if (data) return data.id as string;
    const { data: created } = await db.from("conversations").insert({ contact_id: contactId, channel, external_id: externalId }).select("id").single();
    return created?.id as string;
  }
  const { data } = await db.from("conversations").select("id").eq("contact_id", contactId).eq("channel", channel).is("external_id", null).maybeSingle();
  if (data) return data.id as string;
  const { data: created } = await db.from("conversations").insert({ contact_id: contactId, channel }).select("id").single();
  return created?.id as string;
}

export type NewMessage = {
  contactId: string;
  channel: "email" | "sms" | "call";
  direction: "inbound" | "outbound";
  author: "lead" | "campaign" | "agent" | "human" | "system";
  authorId?: string | null;
  subject?: string | null;
  body: string;
  externalId?: string | null;
  threadId?: string | null;
  status?: string;
  meta?: Record<string, unknown>;
  at?: string;
};

/** Inserts a message once. Returns the new row id, or null if it was already stored. */
export async function recordMessage(m: NewMessage): Promise<string | null> {
  const db = adminDb();
  const conversationId = await conversationFor(m.contactId, m.channel, m.threadId);
  const at = m.at ?? new Date().toISOString();
  const { data, error } = await db
    .from("messages")
    .insert({
      contact_id: m.contactId, conversation_id: conversationId, channel: m.channel, direction: m.direction, author: m.author,
      author_id: m.authorId ?? null, subject: m.subject ?? null, body: m.body, external_id: m.externalId ?? null,
      status: m.status ?? (m.direction === "inbound" ? "received" : "sent"), meta: m.meta ?? {}, created_at: at,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return null; // already stored
    throw error;
  }
  await db.from("conversations").update({ last_message_at: at, unread: m.direction === "inbound" }).eq("id", conversationId);
  await db.from("contacts").update(m.direction === "inbound" ? { last_inbound_at: at } : { last_outbound_at: at }).eq("id", m.contactId);
  return data.id as string;
}

/** STOP-style keywords + plain-language requests. Checked in code before any assistant reply. */
const OPT_OUT = /^\s*(stop|stopall|unsubscribe|cancel|end|quit|revoke|opt[\s-]?out)\s*[.!]*\s*$/i;
const OPT_OUT_PHRASES = /\b(don'?t (text|email|contact|message) me|stop (texting|emailing|messaging|contacting)|remove me|take me off|unsubscribe me|leave me alone|do not contact)\b/i;
export const isOptOut = (text: string) => OPT_OUT.test(text) || OPT_OUT_PHRASES.test(text);

export async function suppress(contact: Contact, channel: "email" | "sms", reason: "stop" | "unsubscribe" | "bounce" | "complaint" | "manual" | "wrong_person") {
  const db = adminDb();
  const value = channel === "email" ? contact.email : contact.cell_phone ?? contact.phone;
  if (value) await db.from("suppressions").upsert({ channel, value, reason }, { onConflict: "channel,value", ignoreDuplicates: true });
  const patch = channel === "email" ? { email_consent: false } : { sms_consent: false };
  await db.from("contacts").update({ ...patch, ...(reason === "bounce" ? {} : { do_not_contact: true }) }).eq("id", contact.id);
  await db.from("outbox").update({ status: "cancelled", error: `suppressed: ${reason}` }).eq("contact_id", contact.id).in("status", ["pending", "draft"]);
  await db.from("followups").update({ status: "cancelled" }).eq("contact_id", contact.id).eq("status", "pending");
  await activity(contact.id, "suppressed", { channel, reason });
}

export async function isSuppressed(channel: "email" | "sms", value: string | null | undefined) {
  if (!value) return true;
  const { data } = await adminDb().from("suppressions").select("id").eq("channel", channel).eq("value", value).maybeSingle();
  return !!data;
}
