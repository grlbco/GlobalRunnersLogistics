import "server-only";
import { adminDb } from "./admin";
import {
  activity, contactByEmail, contactByPhone, createInboundContact, isOptOut, logEvent, moveStage, recordMessage, suppress, type Contact,
} from "./ingest";
import * as quo from "@/lib/integrations/quo";
import { emit } from "@/lib/automations/engine";
import * as instantly from "@/lib/integrations/instantly";

/**
 * Pull-based sync (works locally with no public URL) + the handlers webhooks call.
 * Cursors live in app_settings.cursors. First run starts "now": no history import.
 */
type Cursors = { quo?: string; instantly?: string };

async function getCursors(): Promise<Cursors> {
  const { data } = await adminDb().from("app_settings").select("value").eq("key", "cursors").maybeSingle();
  return (data?.value as Cursors) ?? {};
}
async function setCursors(c: Cursors) {
  await adminDb().from("app_settings").upsert({ key: "cursors", value: c, updated_at: new Date().toISOString() });
}

export type SyncResult = { quo: { conversations: number; newMessages: number; error?: string }; instantly: { scanned: number; newMessages: number; error?: string } };

// ---------------- Quo (texts) ----------------

/** One inbound or outbound text → CRM. Returns the new message id if it was new. */
export async function ingestQuoMessage(m: quo.QuoMessage): Promise<string | null> {
  const ours = quo.fromNumber();
  const inbound = m.direction === "incoming";
  const other = inbound ? m.from : m.to.find((t) => t !== ours) ?? m.to[0];
  if (!other || other === ours) return null;
  if (other === process.env.NOTIFY_SMS_TO) return null; // Ken texting our line is not a lead
  let contact: Contact | null = await contactByPhone(other);
  if (!contact) {
    if (!inbound) return null; // outbound texts to unknown numbers aren't ours to track
    contact = await createInboundContact({ phone: other, source: "inbound_text" });
  }
  const id = await recordMessage({
    contactId: contact.id, channel: "sms", direction: inbound ? "inbound" : "outbound", author: inbound ? "lead" : "human",
    body: m.text ?? "", externalId: m.id, threadId: m.conversationId ?? null, at: m.createdAt, status: inbound ? "received" : "sent",
    meta: { quo_user: m.userId ?? null },
  });
  if (id && !inbound && m.userId) {
    // sent by a person from the Quo app (not by us through the API): pause the assistant
    const { data: viaCrm } = await adminDb().from("outbox").select("id").eq("message_id", id).maybeSingle();
    if (!viaCrm) {
      const { pauseAssistantForHuman } = await import("./outbox");
      await pauseAssistantForHuman(contact.id);
    }
  }
  if (!id || !inbound) return id;

  if (isOptOut(m.text)) {
    await suppress(contact, "sms", "stop");
    await moveStage(contact, "unsubscribed", "quo");
    return id;
  }
  // Texting us first = consent to reply by text (TCPA: responding to an inbound message).
  await moveStage(contact, "replied", "quo", { sms_consent: true, ...(contact.cell_phone ? {} : { cell_phone: other }) });
  await enqueueAgent(contact.id, id, "text_received");
  await emit("text_received", contact.id, {});
  return id;
}

export async function syncQuo(since: string): Promise<{ conversations: number; newMessages: number }> {
  const convs = await quo.conversationsSince(since);
  let newMessages = 0;
  for (const c of convs) {
    const participant = c.participants?.find((p) => p !== quo.fromNumber());
    if (!participant) continue;
    const msgs = await quo.messagesWith(participant, since);
    for (const m of msgs.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      if (await ingestQuoMessage({ ...m, conversationId: m.conversationId ?? c.id })) newMessages++;
    }
  }
  return { conversations: convs.length, newMessages };
}

// ---------------- Instantly (email) ----------------

export async function ingestInstantlyEmail(e: instantly.InstantlyEmail): Promise<string | null> {
  const lead = (e.lead ?? "").toLowerCase();
  if (!lead) return null;
  const inbound = e.ue_type === 2 || (e.from_address_email ?? "").toLowerCase() === lead;
  let contact = await contactByEmail(lead);
  if (!contact) {
    if (!inbound) return null;
    contact = await createInboundContact({ email: lead, source: "inbound_email" });
  }
  const body = (e.body?.text ?? e.content_preview ?? "").trim();
  const id = await recordMessage({
    contactId: contact.id, channel: "email", direction: inbound ? "inbound" : "outbound",
    author: inbound ? "lead" : e.ue_type === 1 ? "campaign" : "human",
    subject: e.subject ?? null, body, externalId: e.id, threadId: e.thread_id ?? null,
    at: e.timestamp_email ?? e.timestamp_created, status: inbound ? "received" : "sent",
    meta: { eaccount: e.eaccount ?? null, campaign_id: e.campaign_id ?? null, auto_reply: !!e.is_auto_reply },
  });
  if (!id) return null;
  if (!inbound) {
    if (e.ue_type === 1) await moveStage(contact, "contacted", "instantly");
    return id;
  }
  if (e.is_auto_reply) {
    await activity(contact.id, "auto_reply", { subject: e.subject ?? null }, "instantly");
    return id;
  }
  if (isOptOut(body)) {
    await suppress(contact, "email", "unsubscribe");
    await moveStage(contact, "unsubscribed", "instantly");
    return id;
  }
  await moveStage(contact, "replied", "instantly");
  await enqueueAgent(contact.id, id, "email_received");
  await emit("email_received", contact.id, {});
  return id;
}

/** Walks Instantly's newest-first email list until it reaches `since`. */
export async function syncInstantly(since: string, search?: string): Promise<{ scanned: number; newMessages: number }> {
  let scanned = 0;
  let newMessages = 0;
  let after: string | undefined;
  const batch: instantly.InstantlyEmail[] = [];
  outer: for (let page = 0; page < 10; page++) {
    const r = await instantly.listEmails({ limit: 100, startingAfter: after, search });
    for (const e of r.items ?? []) {
      scanned++;
      if ((e.timestamp_email ?? e.timestamp_created) < since) break outer;
      batch.push(e);
    }
    if (!r.next_starting_after) break;
    after = r.next_starting_after;
  }
  for (const e of batch.reverse()) if (await ingestInstantlyEmail(e)) newMessages++;
  return { scanned, newMessages };
}

/** Lead-status webhooks (opens, clicks, interest, bounces, unsubscribes). Replies are pulled by syncInstantly. */
export async function handleInstantlyStatus(event: { event_type: string; lead_email?: string; [k: string]: unknown }) {
  const email = event.lead_email?.toLowerCase();
  const contact = email ? await contactByEmail(email) : null;
  await logEvent("instantly", event.event_type, event, contact?.id);
  if (!contact) return;
  switch (event.event_type) {
    case "email_sent":
      await moveStage(contact, "contacted", "instantly");
      break;
    case "email_opened":
    case "link_clicked":
    case "email_link_clicked":
      await activity(contact.id, event.event_type === "email_opened" ? "email_opened" : "link_clicked", { campaign: event.campaign_name ?? null }, "instantly");
      await emit(event.event_type === "email_opened" ? "email_opened" : "link_clicked", contact.id, {});
      break;
    case "lead_interested":
      await moveStage(contact, "interested", "instantly");
      break;
    case "lead_not_interested":
      await moveStage(contact, "not_interested", "instantly");
      break;
    case "lead_wrong_person":
      await suppress(contact, "email", "wrong_person");
      await moveStage(contact, "not_fit", "instantly");
      break;
    case "email_bounced":
      await suppress(contact, "email", "bounce");
      await moveStage(contact, "bounced", "instantly");
      break;
    case "lead_unsubscribed":
      await suppress(contact, "email", "unsubscribe");
      await moveStage(contact, "unsubscribed", "instantly");
      break;
  }
}

// ---------------- assistant hook (phase 4 fills this in) ----------------

export async function enqueueAgent(contactId: string, messageId: string, trigger: string) {
  const db = adminDb();
  // The driver just wrote: anything we had waiting for them is stale now, the next run answers with full context.
  await db.from("outbox").update({ status: "cancelled", error: "driver replied first" }).eq("contact_id", contactId).eq("author", "agent").in("status", ["draft", "pending"]);
  await db.from("agent_runs").insert({ contact_id: contactId, trigger, input_message_id: messageId, action: "queued" });
}

// ---------------- full tick ----------------

export async function syncAll(): Promise<SyncResult> {
  const now = new Date().toISOString();
  const cur = await getCursors();
  const start = { quo: cur.quo ?? now, instantly: cur.instantly ?? now };
  const res: SyncResult = { quo: { conversations: 0, newMessages: 0 }, instantly: { scanned: 0, newMessages: 0 } };
  const next: Cursors = { ...cur };
  // overlap 2 min so nothing slips between ticks; duplicates are ignored by the unique index
  const back = (iso: string) => new Date(new Date(iso).getTime() - 120_000).toISOString();
  try {
    res.quo = await syncQuo(back(start.quo));
    next.quo = now;
  } catch (e) {
    res.quo.error = e instanceof Error ? e.message : String(e);
  }
  try {
    res.instantly = await syncInstantly(back(start.instantly));
    next.instantly = now;
  } catch (e) {
    res.instantly.error = e instanceof Error ? e.message : String(e);
  }
  await setCursors(next);
  return res;
}
