"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/crm/auth";
import { STAGE_KEYS } from "@/lib/crm/stages";

const id = z.string().uuid();

export async function setStage(formData: FormData) {
  const { supabase, staff } = await requireStaff();
  const parsed = z.object({ id, stage: z.enum(STAGE_KEYS as [string, ...string[]]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { data: before } = await supabase.from("contacts").select("stage").eq("id", parsed.data.id).single();
  if (!before || before.stage === parsed.data.stage) return;
  await supabase.from("contacts").update({ stage: parsed.data.stage, stage_changed_at: new Date().toISOString() }).eq("id", parsed.data.id);
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
  const { supabase, staff } = await requireStaff();
  const parsed = z.object({ id, body: z.string().trim().min(1).max(5000) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await supabase.from("notes").insert({ contact_id: parsed.data.id, author_id: staff.id, body: parsed.data.body });
  revalidatePath(`/crm/contacts/${parsed.data.id}`);
}

export async function setAgentMode(formData: FormData) {
  const { supabase, staff } = await requireStaff();
  const parsed = z.object({ id, mode: z.enum(["auto", "manual"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await supabase.from("contacts").update({ agent_mode: parsed.data.mode }).eq("id", parsed.data.id);
  await supabase.from("activities").insert({
    contact_id: parsed.data.id,
    type: parsed.data.mode === "manual" ? "taken_over" : "assistant_resumed",
    actor: `user:${staff.id}`,
  });
  revalidatePath(`/crm/contacts/${parsed.data.id}`);
}

export type SendState = { ok: boolean; message: string } | null;

/** Manual email/text from the profile. Goes through the outbox so every check applies. */
export async function sendManual(_prev: SendState, formData: FormData): Promise<SendState> {
  const { supabase, staff } = await requireStaff();
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
  const { supabase, staff } = await requireStaff();
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
  const { supabase, staff } = await requireStaff();
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
  const { supabase } = await requireStaff();
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
  const { supabase } = await requireStaff();
  if (!id.safeParse(contactId).success) return;
  await supabase.from("conversations").update({ unread: false }).eq("contact_id", contactId).eq("unread", true);
}

/** Approve an assistant draft (optionally edited) and send it now. */
export async function approveDraft(formData: FormData) {
  const { supabase, staff } = await requireStaff();
  const parsed = z.object({ id, contact_id: id, body: z.string().trim().min(1).max(1500) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await supabase.from("outbox").update({ status: "pending", body: parsed.data.body, send_after: new Date().toISOString(), author_id: staff.id }).eq("id", parsed.data.id).in("status", ["draft", "pending"]);
  const { processRow } = await import("@/lib/crm/outbox");
  const out = await processRow(parsed.data.id);
  await supabase.from("activities").insert({ contact_id: parsed.data.contact_id, type: out.ok ? "draft_approved" : "draft_failed", data: out.ok ? {} : { reason: out.reason }, actor: `user:${staff.id}` });
  revalidatePath(`/crm/contacts/${parsed.data.contact_id}`);
  revalidatePath("/crm/inbox");
}

export async function discardDraft(formData: FormData) {
  const { supabase, staff } = await requireStaff();
  const parsed = z.object({ id, contact_id: id }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await supabase.from("outbox").update({ status: "cancelled", error: "discarded by staff" }).eq("id", parsed.data.id).in("status", ["draft", "pending"]);
  await supabase.from("activities").insert({ contact_id: parsed.data.contact_id, type: "draft_discarded", actor: `user:${staff.id}` });
  revalidatePath(`/crm/contacts/${parsed.data.contact_id}`);
  revalidatePath("/crm/inbox");
}

export async function saveAssistantSettings(formData: FormData) {
  const { supabase, staff } = await requireStaff();
  if (staff.role !== "admin") return;
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
  const { supabase } = await requireStaff();
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
  const { supabase, staff } = await requireStaff();
  if (staff.role !== "admin") return;
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
  const { supabase } = await requireStaff();
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
