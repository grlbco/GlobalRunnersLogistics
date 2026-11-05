"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/crm/auth";
import { adminDb } from "@/lib/crm/admin";
import { clearSendingCache } from "@/lib/crm/sending";

type R = { ok: boolean; error?: string; message?: string };

export async function setSending(on: boolean): Promise<R> {
  const { staff } = await requireStaff();
  if (staff.role !== "admin") return { ok: false, error: "Only admins can change this." };
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
  if (staff.role !== "admin") return { ok: false, error: "Only admins can change this." };
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

const inviteZ = z.object({ email: z.string().trim().toLowerCase().email(), name: z.string().trim().min(1).max(120), role: z.enum(["recruiter", "admin"]) });
/** Creates the login with a temporary password (shown once) and gives CRM access. */
export async function addTeamMember(input: unknown): Promise<R & { password?: string }> {
  const { staff } = await requireStaff();
  if (staff.role !== "admin") return { ok: false, error: "Only admins can add people." };
  const p = inviteZ.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the details" };
  const db = adminDb();
  const password = `${randomBytes(9).toString("base64url")}!7`;
  let userId: string | null = null;
  const { data: created, error } = await db.auth.admin.createUser({ email: p.data.email, password, email_confirm: true, user_metadata: { full_name: p.data.name } });
  if (error) {
    // already has an account (e.g. a driver login): just give access, no new password
    const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = list?.users.find((u) => u.email?.toLowerCase() === p.data.email)?.id ?? null;
    if (!userId) return { ok: false, error: error.message };
  } else userId = created.user.id;
  await db.from("profiles").upsert({ id: userId, full_name: p.data.name, role: p.data.role });
  revalidatePath("/crm/settings");
  return created?.user ? { ok: true, password, message: `Added. Give them this temporary password: they change it in Settings after logging in.` } : { ok: true, message: "They already had an account, access granted with their current password." };
}

export async function setRole(input: { id: string; role: "recruiter" | "admin" | "remove" }): Promise<R> {
  const { staff } = await requireStaff();
  if (staff.role !== "admin") return { ok: false, error: "Only admins can change roles." };
  if (!/^[0-9a-f-]{36}$/.test(input.id)) return { ok: false, error: "Bad user" };
  if (input.id === staff.id) return { ok: false, error: "You can't change your own role." };
  const db = adminDb();
  if (input.role !== "remove") {
    await db.from("profiles").update({ role: input.role }).eq("id", input.id);
  } else {
    const { count } = await db.from("profiles").select("*", { count: "exact", head: true }).eq("role", "admin").neq("id", input.id);
    if (!count) return { ok: false, error: "Keep at least one admin." };
    await db.from("profiles").update({ role: "applicant" }).eq("id", input.id);
    await db.auth.admin.signOut(input.id).catch(() => {});
  }
  revalidatePath("/crm/settings");
  return { ok: true, message: input.role === "remove" ? "Access removed" : "Role updated" };
}

export async function changeMyPassword(input: { password: string; confirm: string }): Promise<R> {
  const { supabase } = await requireStaff();
  if (typeof input?.password !== "string" || input.password.length < 10) return { ok: false, error: "Use at least 10 characters." };
  if (input.password !== input.confirm) return { ok: false, error: "The two passwords don't match." };
  if (/^(.)\1+$/.test(input.password) || /^(1234|password|qwerty)/i.test(input.password)) return { ok: false, error: "Pick a harder password." };
  const { error } = await supabase.auth.updateUser({ password: input.password });
  if (error) return { ok: false, error: error.message };
  const { staff } = await requireStaff();
  const db = adminDb();
  const { data } = await db.from("app_settings").select("value").eq("key", "golive").maybeSingle();
  const v = (data?.value ?? {}) as { password_changed?: Record<string, string> };
  await db.from("app_settings").upsert({ key: "golive", value: { ...v, password_changed: { ...(v.password_changed ?? {}), [staff.id]: new Date().toISOString() } }, updated_at: new Date().toISOString() });
  return { ok: true, message: "Password changed" };
}

const MANUAL = ["leaked_pw", "ken_facts", "pilot_tested", "call_tested"] as const;
/** Ticks a manual item on the go-live checklist. */
export async function toggleGoLive(item: string, done: boolean): Promise<R> {
  const { staff } = await requireStaff();
  if (staff.role !== "admin") return { ok: false, error: "Only admins." };
  if (!(MANUAL as readonly string[]).includes(item)) return { ok: false, error: "Unknown item" };
  const db = adminDb();
  const { data } = await db.from("app_settings").select("value").eq("key", "golive").maybeSingle();
  const v = (data?.value ?? {}) as { manual?: Record<string, boolean> };
  await db.from("app_settings").upsert({ key: "golive", value: { ...v, manual: { ...(v.manual ?? {}), [item]: done } }, updated_at: new Date().toISOString() });
  revalidatePath("/crm");
  return { ok: true };
}
