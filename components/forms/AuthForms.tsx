"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, signUp, requestPasswordReset, updatePassword, type AuthState } from "@/app/actions/auth";
import { TextField, ErrorText } from "./fields";
import { Arrow } from "@/components/ui/Button";
import type { Locale } from "@/lib/i18n";

function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={pending} className="inline-flex h-14 w-full items-center justify-center gap-2 rounded bg-signal font-medium transition-colors hover:bg-signal-ink disabled:opacity-60">
      {pending ? "…" : children} {!pending && <Arrow />}
    </button>
  );
}

function Notice({ state }: { state: AuthState }) {
  if (state?.message) return <p className="rounded border border-white/15 bg-white/[0.04] p-4 text-white/80">{state.message}</p>;
  return <ErrorText>{state?.error}</ErrorText>;
}

export function LoginForm({ locale, paths }: { locale: Locale; paths: { register: string; reset: string } }) {
  const sp = useSearchParams();
  const [state, action, pending] = useActionState(signIn, undefined);
  const linkError = sp.get("error") === "link";
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={sp.get("next") ?? ""} />
      {linkError && <ErrorText>That link is invalid or expired. Please try again.</ErrorText>}
      <TextField label="Email" name="email" type="email" autoComplete="email" required />
      <TextField label="Password" name="password" type="password" autoComplete="current-password" required />
      <Notice state={state} />
      <Submit pending={pending}>Log in</Submit>
      <div className="flex justify-between text-sm text-white/60">
        <Link href={paths.reset} className="hover:text-white">Forgot password?</Link>
        <Link href={paths.register} className="hover:text-white">Create an account</Link>
      </div>
    </form>
  );
}

export function RegisterForm({ locale, paths }: { locale: Locale; paths: { login: string; terms: string; privacy: string } }) {
  const sp = useSearchParams();
  const [state, action, pending] = useActionState(signUp, undefined);
  if (state?.message)
    return (
      <div className="space-y-4">
        <h2 className="h3">Almost there.</h2>
        <p className="text-white/70">{state.message}</p>
      </div>
    );
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="locale" value={locale} />
      <TextField label="Full name" name="full_name" autoComplete="name" required />
      <TextField label="Mobile phone" name="phone" type="tel" autoComplete="tel" />
      <TextField label="Email" name="email" type="email" autoComplete="email" defaultValue={sp.get("email") ?? ""} required />
      <TextField label="Password" hint="8+ characters" name="password" type="password" autoComplete="new-password" minLength={8} required />
      <Notice state={state} />
      <Submit pending={pending}>Create account</Submit>
      <p className="text-sm text-white/50">
        By creating an account you agree to our <Link href={paths.terms} className="underline underline-offset-2">Terms</Link> and{" "}
        <Link href={paths.privacy} className="underline underline-offset-2">Privacy Policy</Link>. Already have one?{" "}
        <Link href={paths.login} className="text-white underline underline-offset-2">Log in</Link>
      </p>
    </form>
  );
}

export function ResetForm({ locale }: { locale: Locale }) {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="locale" value={locale} />
      <TextField label="Email" name="email" type="email" autoComplete="email" required />
      <Notice state={state} />
      <Submit pending={pending}>Send reset link</Submit>
    </form>
  );
}

export function UpdatePasswordForm({ locale }: { locale: Locale }) {
  const [state, action, pending] = useActionState(updatePassword, undefined);
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="locale" value={locale} />
      <TextField label="New password" hint="8+ characters" name="password" type="password" autoComplete="new-password" minLength={8} required />
      <Notice state={state} />
      <Submit pending={pending}>Save password</Submit>
    </form>
  );
}
