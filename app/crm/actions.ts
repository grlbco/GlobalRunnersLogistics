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
