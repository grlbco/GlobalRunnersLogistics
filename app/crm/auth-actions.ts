"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { adminDb } from "@/lib/crm/admin";
import { currentStaff } from "@/lib/crm/auth";
import { homeFor, safeNext } from "@/lib/crm/permissions";
import { company } from "@/content/facts";

export type FormState = { error?: string; message?: string } | undefined;

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL || company.url);
}

async function audit(action: string, userId: string, data: Record<string, unknown> = {}) {
  await adminDb().from("staff_audit").insert({ action, actor_id: userId, target_id: userId, data }).then(() => {}, () => {});
}

/** Staff sign-in. There is no sign-up: accounts are created by an admin on the Team page. */
export async function crmSignIn(_: FormState, form: FormData): Promise<FormState> {
  const p = z
    .object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200), next: z.string().optional() })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Enter your email and password." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: p.data.email, password: p.data.password });
  if (error || !data.user) {
    if (error?.message?.toLowerCase().includes("banned")) return { error: "This account is suspended. Ask an admin." };
    return { error: "Wrong email or password." };
  }
  const { data: prof } = await supabase
    .from("profiles")
    .select("crm_role, staff_status, permissions_grant, permissions_deny, crm_roles(permissions)")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!prof?.crm_role || prof.staff_status !== "active") {
    await supabase.auth.signOut();
    return { error: prof?.staff_status === "suspended" ? "This account is suspended. Ask an admin." : "This account doesn't have CRM access. Ask an admin to add you." };
  }
  await audit("signed_in", data.user.id);
  const { effectivePerms } = await import("@/lib/crm/permissions");
  const role = (Array.isArray(prof.crm_roles) ? prof.crm_roles[0] : prof.crm_roles) as { permissions: string[] } | null;
  const perms = effectivePerms(role?.permissions, prof.permissions_grant ?? [], prof.permissions_deny ?? []);
  const wanted = safeNext(p.data.next, "");
  redirect(wanted && wanted !== "/crm" ? wanted : homeFor(perms));
}

/** Always answers the same way, so nobody can test which emails have accounts. */
export async function crmForgotPassword(_: FormState, form: FormData): Promise<FormState> {
  const p = z.object({ email: z.string().trim().toLowerCase().email() }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Enter a valid email." };
  const generic = { message: "If that email has CRM access, a reset link is on its way. Check your inbox (and spam)." };
  const db = adminDb();
  // only staff get a CRM reset link
  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = list?.users.find((u) => u.email?.toLowerCase() === p.data.email);
  if (!user) return generic;
  const { data: prof } = await db.from("profiles").select("crm_role, staff_status").eq("id", user.id).maybeSingle();
  if (!prof?.crm_role || prof.staff_status !== "active") return generic;
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(p.data.email, { redirectTo: `${await origin()}/crm/auth/callback?next=/crm/reset` });
  await audit("password_reset_requested", user.id);
  return generic;
}

const pwZ = z
  .object({ password: z.string().min(10, "Use at least 10 characters.").max(72, "Use at most 72 characters."), confirm: z.string(), next: z.string().optional() })
  .refine((v) => v.password === v.confirm, { message: "The two passwords don't match.", path: ["confirm"] })
  .refine((v) => !/^(.)\1+$/.test(v.password) && !/^(1234|password|qwerty|globalrunners)/i.test(v.password), { message: "Pick a harder password.", path: ["password"] });

/** New password: first sign-in with a temporary password, a reset link, or the Account page. */
export async function setNewPassword(_: FormState, form: FormData): Promise<FormState> {
  const p = pwZ.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Check the password." };
  const loaded = await currentStaff();
  if (loaded.state !== "ok") return { error: "Your session ended. Sign in again." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: p.data.password });
  if (error) {
    if (/same|different/i.test(error.message)) return { error: "Choose a password you haven't used here before." };
    if (/weak|pwned|leaked/i.test(error.message)) return { error: "That password appears in known data leaks. Pick another one." };
    return { error: error.message };
  }
  const db = adminDb();
  const id = loaded.staff.id;
  await db.from("profiles").update({ must_change_password: false }).eq("id", id);
  // go-live checklist: someone changed the starting password
  const { data } = await db.from("app_settings").select("value").eq("key", "golive").maybeSingle();
  const v = (data?.value ?? {}) as { password_changed?: Record<string, string> };
  await db.from("app_settings").upsert({ key: "golive", value: { ...v, password_changed: { ...(v.password_changed ?? {}), [id]: new Date().toISOString() } }, updated_at: new Date().toISOString() });
  await audit("password_changed", id);
  if (p.data.next === "stay") return { message: "Password changed." };
  const target = safeNext(p.data.next, "");
  redirect(target && target !== "/crm" ? target : homeFor(loaded.staff.perms));
}

export async function crmSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/crm/login");
}
