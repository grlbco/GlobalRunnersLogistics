"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/crm/auth";

type Res = { ok: boolean; message: string };
const fail = (e: unknown): Res => ({ ok: false, message: e instanceof Error ? e.message : String(e) });

async function admin() {
  const ctx = await requireStaff();
  if (ctx.staff.role !== "admin") throw new Error("Only admins can manage campaigns");
  return ctx;
}

export async function createDraft() {
  const { supabase, staff } = await admin();
  const { DEFAULT_SEQUENCE, DEFAULT_SETTINGS } = await import("@/lib/crm/campaigns");
  const { data } = await supabase
    .from("campaigns")
    .insert({ name: `Drivers — tier 1 — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, sequence: DEFAULT_SEQUENCE, settings: DEFAULT_SETTINGS, created_by: staff.id })
    .select("id")
    .single();
  if (data) redirect(`/crm/campaigns/${data.id}`);
}

const saveSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(150),
  sequence: z.array(z.object({ delay_days: z.number().min(0).max(30), variants: z.array(z.object({ subject: z.string().max(200), body: z.string().min(1).max(5000) })).min(1).max(5) })).min(1).max(8),
  settings: z.object({ accounts: z.array(z.string().email()), daily_limit: z.number().min(1).max(1000), from: z.string(), to: z.string(), days: z.array(z.number().min(0).max(6)).min(1), timezone: z.string(), tiers: z.array(z.number()).optional() }),
});

export async function saveCampaign(input: unknown): Promise<Res> {
  try {
    const { supabase } = await admin();
    const p = saveSchema.safeParse(input);
    if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Invalid" };
    const { data: cur } = await supabase.from("campaigns").select("instantly_id").eq("id", p.data.id).single();
    if (cur?.instantly_id) return { ok: false, message: "Already created in Instantly; edit copy there or duplicate this campaign." };
    if (!p.data.sequence[0].variants.every((v) => v.subject.trim())) return { ok: false, message: "Every first-email version needs a subject." };
    await supabase.from("campaigns").update({ name: p.data.name, sequence: p.data.sequence, settings: p.data.settings }).eq("id", p.data.id);
    revalidatePath(`/crm/campaigns/${p.data.id}`);
    return { ok: true, message: "Saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function createInInstantly(id: string): Promise<Res> {
  try {
    await admin();
    const { pushToInstantly } = await import("@/lib/crm/campaigns");
    await pushToInstantly(id);
    revalidatePath(`/crm/campaigns/${id}`);
    return { ok: true, message: "Created in Instantly (paused). Add leads, then activate." };
  } catch (e) {
    return fail(e);
  }
}

export async function addLeadsWave(id: string, tiers: number[], states: string[], count: number): Promise<Res> {
  try {
    await admin();
    const { addWave } = await import("@/lib/crm/campaigns");
    const n = await addWave(id, { tiers, states, count: Math.min(Math.max(1, count), 5000) });
    revalidatePath(`/crm/campaigns/${id}`);
    return { ok: true, message: n ? `Added ${n.toLocaleString("en-US")} leads.` : "No new leads match these filters." };
  } catch (e) {
    return fail(e);
  }
}

export async function setCampaignState(id: string, action: "activate" | "pause"): Promise<Res> {
  try {
    const { supabase } = await admin();
    const { data: c } = await supabase.from("campaigns").select("instantly_id, leads_added").eq("id", id).single();
    if (!c?.instantly_id) return { ok: false, message: "Not in Instantly yet" };
    if (action === "activate" && !c.leads_added) return { ok: false, message: "Add leads before activating" };
    const inst = await import("@/lib/integrations/instantly");
    if (action === "activate") await inst.activateCampaign(c.instantly_id);
    else await inst.pauseCampaign(c.instantly_id);
    await supabase.from("campaigns").update({ status: action === "activate" ? "active" : "paused" }).eq("id", id);
    revalidatePath(`/crm/campaigns/${id}`);
    revalidatePath("/crm/campaigns");
    return { ok: true, message: action === "activate" ? "Campaign is sending." : "Campaign paused." };
  } catch (e) {
    return fail(e);
  }
}

export async function refreshStats(id: string): Promise<Res> {
  try {
    await requireStaff();
    const { syncCampaignStats } = await import("@/lib/crm/campaigns");
    await syncCampaignStats(true);
    revalidatePath(`/crm/campaigns/${id}`);
    return { ok: true, message: "Stats updated" };
  } catch (e) {
    return fail(e);
  }
}
