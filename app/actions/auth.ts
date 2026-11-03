"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { company } from "@/content/facts";

export type AuthState = { error?: string; message?: string } | undefined;

const safeNext = (next: unknown, fallback: string) =>
  typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : fallback;

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : company.url;
}

const prefix = (locale: string) => (locale === "es" ? "/es" : "");

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z
    .object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1), next: z.string().optional(), locale: z.string().optional() })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter your email and password." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) return { error: error.message === "Email not confirmed" ? "Please confirm your email first — check your inbox." : "Wrong email or password." };
  redirect(safeNext(parsed.data.next, `${prefix(parsed.data.locale ?? "en")}/dashboard`));
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z
    .object({
      full_name: z.string().trim().min(2, "Enter your full name").max(120),
      phone: z.string().trim().max(32).optional(),
      email: z.string().trim().toLowerCase().email("Enter a valid email"),
      password: z.string().min(8, "Use at least 8 characters").max(72),
      locale: z.enum(["en", "es"]).default("en"),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: d.email,
    password: d.password,
    options: {
      data: { full_name: d.full_name, phone: d.phone, locale: d.locale },
      emailRedirectTo: `${await origin()}${prefix(d.locale)}/auth/callback?next=${prefix(d.locale)}/dashboard`,
    },
  });
  if (error) return { error: error.message };
  return { message: d.locale === "es" ? "Revisa tu correo para confirmar tu cuenta." : "Check your email to confirm your account." };
}

export async function requestPasswordReset(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const locale = String(form.get("locale") ?? "en");
  if (!email.includes("@")) return { error: "Enter your email." };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await origin()}${prefix(locale)}/auth/callback?next=${prefix(locale)}/update-password`,
  });
  // Same message whether or not the account exists.
  return { message: "If that email has an account, a reset link is on its way." };
}

export async function updatePassword(_: AuthState, form: FormData): Promise<AuthState> {
  const password = String(form.get("password") ?? "");
  const locale = String(form.get("locale") ?? "en");
  if (password.length < 8) return { error: "Use at least 8 characters." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Your reset link expired. Request a new one." };
  redirect(`${prefix(locale)}/dashboard`);
}

export async function signOut(form: FormData) {
  const locale = String(form.get("locale") ?? "en");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`${prefix(locale)}/login`);
}
