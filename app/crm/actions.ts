"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePerm } from "@/lib/crm/auth";
import { STAGE_KEYS } from "@/lib/crm/stages";

const id = z.string().uuid();

export async function setStage(formData: FormData) {
  const { supabase, staff } = await requirePerm("contacts.edit");
  const parsed = z.object({ id, stage: z.enum(STAGE_KEYS as [string, ...string[]]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { data: before } = await supabase.from("contacts").select("stage").eq("id", parsed.data.id).single();
  if (!before || before.stage === parsed.data.stage) return;
  // A person moved the card: lock it and take over, so the AI can't undo this or talk over them.
  const now = new Date().toISOString();
  await supabase.from("contacts").update({ stage: parsed.data.stage, stage_changed_at: now, stage_locked_at: now, stage_locked_by: staff.id, agent_mode: "manual" }).eq("id", parsed.data.id);
  const { adminDb } = await import("@/lib/crm/admin");
  await adminDb().from("stage_events").insert({ contact_id: parsed.data.id, from_stage: before.stage, to_stage: parsed.data.stage, actor_type: "human", actor: `user:${staff.id}`, decision: "applied" });
  await supabase.from("activities").insert({
    contact_id: parsed.data.id,
    type: "stage_changed",
    data: { from: before.stage, to: parsed.data.stage },
    actor: `user:${staff.id}`,
  });
  const { emit } = await import("@/lib/automations/engine");
  await emit("stage_changed", parsed.data.id, { from: before.stage, to: parsed.data.stage });
  revalidatePath(`/crm/contacts/${parsed.data.id}`);
  revalidatePath("/crm/pipeline");
}

export async function addNote(formData: FormData) {
  const { supabase, staff } = await requirePerm("contacts.edit");
  const parsed = z.object({ id, body: z.string().trim().min(1).max(5000) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await supabase.from("notes").insert({ contact_id: parsed.data.id, author_id: staff.id, body: parsed.data.body });
  revalidatePath(`/crm/contacts/${parsed.data.id}`);
}

export async function setAgentMode(formData: FormData) {
  const { supabase, staff } = await requirePerm("contacts.edit");
  const parsed = z.object({ id, mode: z.enum(["auto", "manual"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  // Handing back is the only thing that unlocks a card a person moved.
  await supabase.from("contacts").update({ agent_mode: parsed.data.mode, ...(parsed.data.mode === "auto" ? { stage_locked_at: null, stage_locked_by: null } : {}) }).eq("id", parsed.data.id);
  await supabase.from("activities").insert({
    contact_id: parsed.data.id,
    type: parsed.data.mode === "manual" ? "taken_over" : "assistant_resumed",
    actor: `user:${staff.id}`,
  });
  revalidatePath(`/crm/contacts/${parsed.data.id}`);
}

/** A person supplies the fact the assistant was missing: it answers the driver and the thread stays automated. */
export async function giveAnswer(formData: FormData) {
  const { staff } = await requirePerm("contacts.message");
  const parsed = z.object({ id, answer: z.string().trim().min(1).max(500) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { adminDb } = await import("@/lib/crm/admin");
  const db = adminDb();
  const { data: mem } = await db.from("agent_memory").select("facts").eq("contact_id", parsed.data.id).maybeSingle();
  const facts = { ...((mem?.facts as Record<string, unknown>) ?? {}), [`answer_from_team_${Date.now()}`]: parsed.data.answer };
  await db.from("agent_memory").upsert({ contact_id: parsed.data.id, facts, updated_at: new Date().toISOString() });
  await db.from("contacts").update({ agent_mode: "auto", agent_paused_until: null, stage_locked_at: null, stage_locked_by: null }).eq("id", parsed.data.id);
  await db.from("tasks").update({ done_at: new Date().toISOString() }).eq("contact_id", parsed.data.id).eq("created_by", "agent").is("done_at", null);
  await db.from("activities").insert({ contact_id: parsed.data.id, type: "assistant_resumed", data: { answer: parsed.data.answer }, actor: `user:${staff.id}` });
  const { runAgent } = await import("@/lib/agent/engine");
  const r = await runAgent({ contactId: parsed.data.id, trigger: "manual" });
  if (r.action === "failed") {
    const { escalateToPerson } = await import("@/lib/agent/rescue");
    await escalateToPerson(parsed.data.id, `The assistant couldn't use your answer: ${r.reason ?? "unknown error"}`);
  }
  revalidatePath(`/crm/contacts/${parsed.data.id}`);
  revalidatePath("/crm/inbox");
}

export type SendState = { ok: boolean; message: string } | null;

/** Manual email/text from the profile. Goes through the outbox so every check applies. */
export async function sendManual(_prev: SendState, formData: FormData): Promise<SendState> {
  const { supabase, staff } = await requirePerm("contacts.message");
  const parsed = z
    .object({ id, channel: z.enum(["email", "sms"]), body: z.string().trim().min(1).max(1500), subject: z.string().trim().max(200).optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Write a message first." };
  const { data: row, error } = await supabase
    .from("outbox")
    .insert({ contact_id: parsed.data.id, channel: parsed.data.channel, author: "human", author_id: staff.id, subject: parsed.data.subject || null, body: parsed.data.body })
    .select("id")
    .single();
  if (error || !row) return { ok: false, message: error?.message ?? "Couldn't queue the message." };
  const { processRow } = await import("@/lib/crm/outbox");
  const out = await processRow(row.id);
  revalidatePath(`/crm/contacts/${parsed.data.id}`);
  return out.ok ? { ok: true, message: parsed.data.channel === "sms" ? "Text sent." : "Email sent." } : { ok: false, message: out.reason };
}

const E164 = /^\+[1-9]\d{7,14}$/;
const toE164 = (v: string) => {
  const d = v.replace(/[^\d+]/g, "");
  if (E164.test(d)) return d;
  const digits = d.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
};

export async function updateContact(formData: FormData) {
  const { supabase, staff } = await requirePerm("contacts.edit");
  const f = Object.fromEntries(formData) as Record<string, string>;
  if (!id.safeParse(f.id).success) return;
  const opt = (v?: string) => (v ?? "").trim() || null;
  const email = opt(f.email)?.toLowerCase() ?? null;
  const cell = opt(f.cell_phone);
  const state = opt(f.state)?.toUpperCase() ?? null;
  const { stateTimezone } = await import("@/lib/crm/timezones");
  const patch = {
    first_name: opt(f.first_name),
    last_name: opt(f.last_name),
    email: email && z.string().email().safeParse(email).success ? email : null,
    cell_phone: cell ? toE164(cell) : null,
    city: opt(f.city),
    state: state && state.length === 2 ? state : null,
    timezone: stateTimezone(state),
  };
  await supabase.from("contacts").update(patch).eq("id", f.id);
  await supabase.from("activities").insert({ contact_id: f.id, type: "details_edited", actor: `user:${staff.id}` });
  revalidatePath(`/crm/contacts/${f.id}`);
}

export async function addTask(formData: FormData) {
  const { supabase, staff } = await requirePerm("contacts.edit");
  const parsed = z
    .object({ contact_id: id.optional(), title: z.string().trim().min(1).max(300), due_at: z.string().optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const due = parsed.data.due_at ? new Date(parsed.data.due_at) : null;
  await supabase.from("tasks").insert({
    contact_id: parsed.data.contact_id ?? null,
    assignee_id: staff.id,
    title: parsed.data.title,
    due_at: due && !Number.isNaN(due.getTime()) ? due.toISOString() : null,
  });
  if (parsed.data.contact_id) revalidatePath(`/crm/contacts/${parsed.data.contact_id}`);
  revalidatePath("/crm");
}

export async function toggleTask(formData: FormData) {
  const { supabase } = await requirePerm("contacts.edit");
  const parsed = z.object({ id, contact_id: id.optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { data: t } = await supabase.from("tasks").select("done_at").eq("id", parsed.data.id).single();
  await supabase.from("tasks").update({ done_at: t?.done_at ? null : new Date().toISOString() }).eq("id", parsed.data.id);
  if (parsed.data.contact_id) revalidatePath(`/crm/contacts/${parsed.data.contact_id}`);
  revalidatePath("/crm");
}

/** Pipeline drag-and-drop. */
export async function moveContact(contactId: string, stage: string) {
  const fd = new FormData();
  fd.set("id", contactId);
  fd.set("stage", stage);
  await setStage(fd);
}

/** Opening a thread marks it read. */
export async function markRead(contactId: string) {
  const { supabase } = await requirePerm("inbox.view");
  if (!id.safeParse(contactId).success) return;
  await supabase.from("conversations").update({ unread: false }).eq("contact_id", contactId).eq("unread", true);
}

/** Approve an assistant draft (optionally edited) and send it now. */
export async function approveDraft(formData: FormData) {
  const { supabase, staff } = await requirePerm("contacts.message");
  const parsed = z.object({ id, contact_id: id, body: z.string().trim().min(1).max(1500) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { data: orig } = await supabase.from("outbox").select("body").eq("id", parsed.data.id).maybeSingle();
  // A person approved it: send now, no quiet-hour hold.
  await supabase.from("outbox").update({ status: "pending", body: parsed.data.body, send_after: new Date().toISOString(), author_id: staff.id, is_reply: true, error: null }).eq("id", parsed.data.id).in("status", ["draft", "pending"]);
  const { processRow } = await import("@/lib/crm/outbox");
  const out = await processRow(parsed.data.id);
  await supabase.from("activities").insert({ contact_id: parsed.data.contact_id, type: out.ok ? "draft_approved" : "draft_failed", data: out.ok ? { edited: (orig?.body ?? "").trim() !== parsed.data.body } : { reason: out.reason }, actor: `user:${staff.id}` });
  if (out.ok) await maybeLeaveDraftMode();
  revalidatePath(`/crm/contacts/${parsed.data.contact_id}`);
  revalidatePath("/crm/inbox");
}

export async function discardDraft(formData: FormData) {
  const { supabase, staff } = await requirePerm("contacts.message");
  const parsed = z.object({ id, contact_id: id }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await supabase.from("outbox").update({ status: "cancelled", error: "discarded by staff" }).eq("id", parsed.data.id).in("status", ["draft", "pending"]);
  await supabase.from("activities").insert({ contact_id: parsed.data.contact_id, type: "draft_discarded", actor: `user:${staff.id}` });
  revalidatePath(`/crm/contacts/${parsed.data.contact_id}`);
  revalidatePath("/crm/inbox");
}

export async function saveAssistantSettings(formData: FormData) {
  const { supabase } = await requirePerm("assistant.manage");
  const f = Object.fromEntries(formData) as Record<string, string>;
  const num = (v: string, lo: number, hi: number, d: number) => Math.min(hi, Math.max(lo, Number(v) || d));
  const value = {
    enabled: f.enabled === "on",
    draft_mode: f.draft_mode === "on",
    max_per_day: num(f.max_per_day, 1, 10, 3),
    delay_min_s: num(f.delay_min_m, 0, 60, 2) * 60,
    delay_max_s: Math.max(num(f.delay_min_m, 0, 60, 2), num(f.delay_max_m, 0, 120, 9)) * 60,
    max_followups: num(f.max_followups, 0, 8, 5),
  };
  await supabase.from("app_settings").upsert({ key: "assistant", value, updated_at: new Date().toISOString() });
  revalidatePath("/crm/assistant");
}

export type TestState = { reply?: string | null; action?: string; channel?: string; json?: string; problems?: string[]; cost?: number; error?: string } | null;

/** Dry run: what would the assistant answer? Nothing is saved or sent. */
export async function testAssistant(_prev: TestState, formData: FormData): Promise<TestState> {
  const { supabase } = await requirePerm("assistant.view");
  const f = Object.fromEntries(formData) as Record<string, string>;
  const body = (f.message ?? "").trim();
  if (!body) return { error: "Type a driver message first." };
  let contactId = f.contact_id;
  if (!id.safeParse(contactId).success) {
    const { data } = await supabase.from("contacts").select("id").contains("tags", ["test"]).limit(1).maybeSingle();
    contactId = data?.id ?? "";
  }
  if (!contactId) return { error: "No test contact found." };
  const { runAgent } = await import("@/lib/agent/engine");
  const r = await runAgent({ contactId, trigger: "test", dryRunMessage: { channel: f.channel === "email" ? "email" : "sms", body } });
  return { reply: r.reply, action: r.action, channel: r.channel, json: r.decision ? JSON.stringify(r.decision, null, 2) : undefined, problems: r.problems, cost: r.costUsd, error: r.reason };
}

/** Big on/off switch. Turning on answers drivers whose last message (48h) is still unanswered. */
export async function setAssistantEnabled(formData: FormData) {
  const { supabase } = await requirePerm("assistant.manage");
  const on = formData.get("on") === "1";
  const { data } = await supabase.from("app_settings").select("value").eq("key", "assistant").maybeSingle();
  await supabase.from("app_settings").upsert({ key: "assistant", value: { ...((data?.value as object) ?? {}), enabled: on }, updated_at: new Date().toISOString() });
  if (on) {
    const since = new Date(Date.now() - 48 * 3600_000).toISOString();
    const { data: recent } = await supabase.from("messages").select("contact_id, id, direction, channel, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(500);
    const latest = new Map<string, { id: string; direction: string; channel: string }>();
    for (const m of recent ?? []) if (!latest.has(m.contact_id)) latest.set(m.contact_id, m);
    for (const [contactId, m] of latest) {
      if (m.direction !== "inbound") continue;
      await supabase.from("agent_runs").insert({ contact_id: contactId, trigger: m.channel === "sms" ? "text_received" : "email_received", input_message_id: m.id, action: "queued" });
    }
  }
  revalidatePath("/crm/assistant");
  revalidatePath("/crm", "layout");
}

/** "Reply now" on a profile: queue an assistant run for this driver right away. */
export async function askAssistant(formData: FormData) {
  const { supabase } = await requirePerm("assistant.view");
  const contactId = String(formData.get("id"));
  if (!id.safeParse(contactId).success) return;
  const { data: last } = await supabase.from("messages").select("id, channel, direction").eq("contact_id", contactId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  await supabase.from("contacts").update({ agent_mode: "auto" }).eq("id", contactId);
  await supabase.from("agent_runs").insert({
    contact_id: contactId,
    trigger: "manual",
    input_message_id: last?.id ?? null,
    action: "queued",
  });
  revalidatePath(`/crm/contacts/${contactId}`);
}

/**
 * Launch safety: the assistant starts in draft mode and switches itself to automatic after
 * `auto_after` approved drafts (default 50), as long as few of them needed edits.
 */
async function maybeLeaveDraftMode() {
  const { adminDb } = await import("@/lib/crm/admin");
  const { getAssistantSettings } = await import("@/lib/crm/settings");
  const s = await getAssistantSettings();
  if (!s.draft_mode || !s.auto_after) return;
  const db = adminDb();
  const { data: rows } = await db.from("activities").select("data").eq("type", "draft_approved").limit(5000);
  const approved = rows?.length ?? 0;
  const edited = (rows ?? []).filter((r) => (r.data as { edited?: boolean } | null)?.edited).length;
  if (approved < s.auto_after || edited / approved > 0.2) return; // too many corrections: stay in draft mode
  const { data: cur } = await db.from("app_settings").select("value").eq("key", "assistant").maybeSingle();
  await db.from("app_settings").upsert({ key: "assistant", value: { ...((cur?.value as object) ?? {}), draft_mode: false }, updated_at: new Date().toISOString() });
  const { sendTelegram } = await import("@/lib/integrations/telegram");
  await sendTelegram(`🤖 <b>The assistant is now automatic.</b> ${approved} drafts approved (${edited} edited), so it replies on its own from here. Switch draft mode back on in Assistant anytime.`);
  revalidatePath("/crm/assistant");
}
