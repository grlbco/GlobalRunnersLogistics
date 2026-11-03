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
