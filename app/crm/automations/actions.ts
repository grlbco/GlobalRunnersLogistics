"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/crm/auth";
import { TRIGGERS } from "@/lib/automations/types";

const stepSchema = z.object({ type: z.string() }).passthrough();
const wfSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  trigger_type: z.enum(Object.keys(TRIGGERS) as [string, ...string[]]),
  trigger_filter: z.record(z.string(), z.string()).default({}),
  steps: z.array(stepSchema).max(40),
  active: z.boolean(),
});

export async function saveWorkflow(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const { supabase, staff } = await requireStaff();
  if (staff.role !== "admin") return { ok: false, error: "Only admins can change automations." };
  const p = wfSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Invalid workflow" };
  const filter = Object.fromEntries(Object.entries(p.data.trigger_filter).filter(([, v]) => v));
  const { error } = await supabase.from("workflows").update({ name: p.data.name, description: p.data.description ?? null, trigger_type: p.data.trigger_type, trigger_filter: filter, steps: p.data.steps, active: p.data.active }).eq("id", p.data.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/crm/automations");
  revalidatePath(`/crm/automations/${p.data.id}`);
  return { ok: true };
}

export async function toggleWorkflow(formData: FormData) {
  const { supabase, staff } = await requireStaff();
  if (staff.role !== "admin") return;
  const id = String(formData.get("id"));
  const { data } = await supabase.from("workflows").select("active").eq("id", id).single();
  await supabase.from("workflows").update({ active: !data?.active }).eq("id", id);
  if (data?.active) await supabase.from("workflow_runs").update({ status: "cancelled" }).eq("workflow_id", id).eq("status", "waiting");
  revalidatePath("/crm/automations");
}

export async function createWorkflow() {
  const { supabase, staff } = await requireStaff();
  if (staff.role !== "admin") return;
  const { data } = await supabase.from("workflows").insert({ name: "New automation", trigger_type: "stage_changed", trigger_filter: { to: "interested" }, steps: [{ type: "wait", hours: 1 }], active: false }).select("id").single();
  if (data) redirect(`/crm/automations/${data.id}`);
}

export async function deleteWorkflow(formData: FormData) {
  const { supabase, staff } = await requireStaff();
  if (staff.role !== "admin") return;
  const id = String(formData.get("id"));
  await supabase.from("workflows").delete().eq("id", id).eq("builtin", false);
  redirect("/crm/automations");
}
