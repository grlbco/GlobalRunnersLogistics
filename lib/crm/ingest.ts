import "server-only";
import { adminDb } from "./admin";
import type { Stage } from "./stages";
import { actorType, advance, decideMove } from "./pipeline";

/**
 * Everything that enters the CRM from Instantly, Quo or the website goes through here,
 * so a message is stored once (unique external id) and stage moves follow lib/crm/pipeline.ts.
 */
export { advance };

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
  const { emit } = await import("@/lib/automations/engine");
  await emit("contact_created", data.id, { source: p.source });
  return data as Contact;
}

export type MoveOptions = { force?: boolean; quote?: string | null; driverText?: string | null; reason?: string | null; model?: string | null };

/** Moves a card if the rules allow it, and records who, why and on what evidence. Rejected AI proposals are recorded too. */
export async function moveStage(contact: Contact, next: Stage, actor = "system", extra: Record<string, unknown> = {}, opts: MoveOptions = {}) {
  const db = adminDb();
  const { data: fresh } = await db.from("contacts").select("stage, stage_locked_at").eq("id", contact.id).maybeSingle();
  const current = (fresh?.stage ?? contact.stage) as Stage;
  const type = actorType(actor);
  const verdict = decideMove({ current, to: next, actor: type, locked: !!fresh?.stage_locked_at, force: opts.force, quote: opts.quote, driverText: opts.driverText });
  const event = { contact_id: contact.id, from_stage: current, actor_type: type, actor, reason: opts.reason ?? null, evidence_quote: opts.quote ?? null, model: opts.model ?? null };

  if (Object.keys(extra).length) await db.from("contacts").update(extra).eq("id", contact.id);
  if (!verdict.apply) {
    if (!verdict.quiet) await db.from("stage_events").insert({ ...event, to_stage: next, decision: "rejected", reject_reason: verdict.reason });
    return { ...contact, ...extra, stage: current } as Contact;
  }

  // Only if the card is still where we read it: a person may have just moved it.
  const { data: moved } = await db.from("contacts").update({ stage: verdict.to, stage_changed_at: new Date().toISOString() }).eq("id", contact.id).eq("stage", current).select("id").maybeSingle();
  if (!moved) {
    await db.from("stage_events").insert({ ...event, to_stage: next, decision: "rejected", reject_reason: "The card changed while this was being decided" });
    return { ...contact, ...extra, stage: current } as Contact;
  }
  await db.from("stage_events").insert({ ...event, to_stage: verdict.to, decision: "applied" });
  await db.from("activities").insert({ contact_id: contact.id, type: "stage_changed", data: { from: current, to: verdict.to, ...(opts.quote ? { quote: opts.quote } : {}) }, actor });
  const { emit } = await import("@/lib/automations/engine");
  await emit("stage_changed", contact.id, { from: current, to: verdict.to });
  return { ...contact, ...extra, stage: verdict.to } as Contact;
}

export async function activity(contactId: string, type: string, data: Record<string, unknown> = {}, actor = "system") {
  await adminDb().from("activities").insert({ contact_id: contactId, type, data, actor });
}

/** Records a provider event. Returns false when this exact event was already recorded, so retries do nothing. */
export async function logEvent(source: "instantly" | "quo" | "website" | "system", type: string, payload: unknown, contactId?: string | null, externalId?: string | null) {
  const { error } = await adminDb().from("events").insert({ source, type, payload, contact_id: contactId ?? null, external_id: externalId ?? null, processed_at: new Date().toISOString() });
  return error?.code !== "23505";
}

async function conversationFor(contactId: string, channel: "email" | "sms" | "call", externalId?: string | null) {
  const db = adminDb();
  if (externalId) {
    const { data } = await db.from("conversations").select("id").eq("channel", channel).eq("external_id", externalId).maybeSingle();
    if (data) return data.id as string;
    // adopt a thread we started from the CRM before the provider gave us its id
    const { data: loose } = await db.from("conversations").select("id").eq("contact_id", contactId).eq("channel", channel).is("external_id", null).limit(1).maybeSingle();
    if (loose) {
      await db.from("conversations").update({ external_id: externalId }).eq("id", loose.id);
      return loose.id as string;
    }
    const { data: created } = await db.from("conversations").insert({ contact_id: contactId, channel, external_id: externalId }).select("id").single();
    return created?.id as string;
  }
  // no provider id: continue the contact's latest thread on this channel
  const { data } = await db.from("conversations").select("id").eq("contact_id", contactId).eq("channel", channel).order("last_message_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
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

/** A Social Security number sent by mistake is never stored, shown to staff, or passed to the AI. */
export const redact = (body: string) => body.replace(/\b\d{3}[- ]\d{2}[- ]\d{4}\b/g, "[SSN removed]");

/** Inserts a message once. Returns the new row id, or null if it was already stored. */
export async function recordMessage(m: NewMessage): Promise<string | null> {
  const db = adminDb();
  const conversationId = await conversationFor(m.contactId, m.channel, m.threadId);
  const at = m.at ?? new Date().toISOString();
  const { data, error } = await db
    .from("messages")
    .insert({
      contact_id: m.contactId, conversation_id: conversationId, channel: m.channel, direction: m.direction, author: m.author,
      author_id: m.authorId ?? null, subject: m.subject ?? null, body: redact(m.body), external_id: m.externalId ?? null,
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

/** The record of who agreed to what, in their own words. How they said it goes in `page`. Never blocks the message that triggered it. */
export async function recordConsent(p: { source: string; phone?: string | null; email?: string | null; text: string; granted?: boolean }) {
  const { error } = await adminDb().from("consents").insert({ source: "contact", page: p.source, phone: p.phone ?? null, email: p.email ?? null, consent_text: p.text.slice(0, 1000), granted: p.granted ?? true });
  if (error) console.error("recordConsent", error.message);
}

/** STOP-style keywords + plain-language requests. Checked in code before any assistant reply. */
const OPT_OUT = /^\s*(please\s+)?(stop|stopall|unsubscribe|cancel|end|quit|revoke|opt[\s-]?out)(\s+(please|now|it|this))*\s*[.!]*\s*$/i;
const OPT_OUT_PHRASES = /\b(don'?t (text|email|contact|message) me|(stop|quit) (texting|emailing|messaging|contacting)|remove me|take me off|unsubscribe me|leave me alone|do not contact|no more (texts?|messages?|emails?)|(lose|delete) my (number|email|info)|no me (escribas|mandes|envies|envíes|contactes)|deja de (escribir|mandar|enviar|contactar))/i;
export const isOptOut = (text: string) => OPT_OUT.test(text) || OPT_OUT_PHRASES.test(text);
export const isWrongNumber = (text: string) => /\bwrong (number|person|guy)\b|\bnot the right person\b|\bno one by that name\b/i.test(text);

export async function suppress(contact: Contact, channel: "email" | "sms", reason: "stop" | "unsubscribe" | "bounce" | "complaint" | "manual" | "wrong_person") {
  const db = adminDb();
  const value = channel === "email" ? contact.email : contact.cell_phone ?? contact.phone;
  if (value) await db.from("suppressions").upsert({ channel, value, reason }, { onConflict: "channel,value", ignoreDuplicates: true });
  const patch = channel === "email" ? { email_consent: false } : { sms_consent: false };
  await db.from("contacts").update({ ...patch, ...(reason === "bounce" ? {} : { do_not_contact: true }) }).eq("id", contact.id);
  await db.from("outbox").update({ status: "cancelled", error: `suppressed: ${reason}` }).eq("contact_id", contact.id).in("status", ["pending", "draft"]);
  await db.from("followups").update({ status: "cancelled" }).eq("contact_id", contact.id).eq("status", "pending");
  await activity(contact.id, "suppressed", { channel, reason });
  if (channel === "sms" && value) await recordConsent({ source: `opt-out: ${reason}`, phone: value, text: reason, granted: false });
}

export async function isSuppressed(channel: "email" | "sms", value: string | null | undefined) {
  if (!value) return true;
  const { data } = await adminDb().from("suppressions").select("id").eq("channel", channel).eq("value", value).maybeSingle();
  return !!data;
}
