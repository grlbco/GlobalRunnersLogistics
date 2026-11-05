"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/crm/auth";
import { adminDb } from "@/lib/crm/admin";
import { clearSendingCache } from "@/lib/crm/sending";

type R = { ok: boolean; error?: string; message?: string };

export async function setSending(on: boolean): Promise<R> {
  const { staff } = await requireStaff();
  if (!staff.can("settings.manage")) return { ok: false, error: "You don't have permission to change this." };
  const db = adminDb();
  await db.from("app_settings").upsert({ key: "sending", value: { enabled: on }, updated_at: new Date().toISOString() });
  if (on) {
    // anything the assistant queued more than 6 hours ago is stale now: drop it instead of sending it late
    await db.from("outbox").update({ status: "cancelled", error: "stale while sending was off" }).eq("status", "pending").eq("author", "agent").lt("created_at", new Date(Date.now() - 6 * 3600_000).toISOString());
  }
  await db.from("activities").insert({ type: on ? "sending_on" : "sending_off", data: {}, actor: `user:${staff.id}` }).then(() => {}, () => {});
  clearSendingCache();
  revalidatePath("/crm/settings");
  revalidatePath("/crm");
  return { ok: true, message: on ? "Sending is on" : "All sending stopped" };
}

const hoursZ = z.object({ start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/), tz: z.string().min(3).max(60), days: z.array(z.number().int().min(0).max(6)).min(1) });
export async function saveCallHours(input: unknown): Promise<R> {
  const { staff } = await requireStaff();
  if (!staff.can("settings.manage")) return { ok: false, error: "You don't have permission to change this." };
  const p = hoursZ.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the hours" };
  if (p.data.start >= p.data.end) return { ok: false, error: "Start must be before end" };
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: p.data.tz });
  } catch {
    return { ok: false, error: "Unknown time zone" };
  }
  await adminDb().from("app_settings").upsert({ key: "calls", value: p.data, updated_at: new Date().toISOString() });
  revalidatePath("/crm/settings");
  return { ok: true, message: "Saved" };
}

const MANUAL = ["leaked_pw", "ken_facts", "pilot_tested", "call_tested"] as const;
/** Ticks a manual item on the go-live checklist. */
export async function toggleGoLive(item: string, done: boolean): Promise<R> {
  const { staff } = await requireStaff();
  if (!staff.can("settings.manage")) return { ok: false, error: "You don't have permission to change this." };
  if (!(MANUAL as readonly string[]).includes(item)) return { ok: false, error: "Unknown item" };
  const db = adminDb();
  const { data } = await db.from("app_settings").select("value").eq("key", "golive").maybeSingle();
  const v = (data?.value ?? {}) as { manual?: Record<string, boolean> };
  await db.from("app_settings").upsert({ key: "golive", value: { ...v, manual: { ...(v.manual ?? {}), [item]: done } }, updated_at: new Date().toISOString() });
  revalidatePath("/crm");
  return { ok: true };
}
