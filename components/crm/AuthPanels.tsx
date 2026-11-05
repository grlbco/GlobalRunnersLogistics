"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";
import { crmForgotPassword, crmSignIn, setNewPassword, type FormState } from "@/app/crm/auth-actions";
import { btnCls, inputCls } from "@/components/crm/ui";

export function AuthShell({ title, sub, children, footer }: { title: string; sub?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh w-full place-items-center px-5 py-12">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex items-center gap-3">
          <Image src="/brand/mark-white.png" alt="" width={32} height={32} className="h-8 w-8" />
          <div>
            <p className="text-[0.95rem] font-semibold leading-tight tracking-[-0.02em]">Command</p>
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-white/40">Global Runners Logistics</p>
          </div>
        </div>
        <h1 className="text-[1.6rem] font-semibold tracking-[-0.03em]">{title}</h1>
        {sub && <p className="mt-2 text-sm leading-relaxed text-white/55">{sub}</p>}
        <div className="mt-7">{children}</div>
        {footer && <div className="mt-6 text-sm text-white/50">{footer}</div>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.8rem] text-white/60">{label}</span>
      {children}
    </label>
  );
}

function Status({ state }: { state: FormState }) {
  if (!state) return null;
  return (
    <p role={state.error ? "alert" : "status"} className={state.error ? "text-sm text-red-300" : "text-sm text-emerald-300"}>
      {state.error ?? state.message}
    </p>
  );
}

export function SignInForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action, pending] = useActionState(crmSignIn, undefined);
  return (
    <form action={action} className="space-y-4">
      {notice && <p className="rounded-[4px] border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70">{notice}</p>}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email">
        <input name="email" type="email" autoComplete="username" required autoFocus className={inputCls} />
      </Field>
      <Field label="Password">
        <input name="password" type="password" autoComplete="current-password" required className={inputCls} />
      </Field>
      <Status state={state} />
      <button disabled={pending} className={`${btnCls} w-full`}>{pending ? "Signing in…" : "Sign in"}</button>
      <div className="flex justify-between pt-1 text-sm">
        <Link href="/crm/forgot" className="text-white/55 underline-offset-4 hover:text-white hover:underline">Forgot password?</Link>
        <span className="text-white/35">Access by invitation only</span>
      </div>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState(crmForgotPassword, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="Work email">
        <input name="email" type="email" autoComplete="username" required autoFocus className={inputCls} />
      </Field>
      <Status state={state} />
      <button disabled={pending} className={`${btnCls} w-full`}>{pending ? "Sending…" : "Send reset link"}</button>
    </form>
  );
}

/** Used on first sign-in (temporary password), after a reset link, and on the Account page (next="stay"). */
export function NewPasswordForm({ next, submitLabel = "Save password" }: { next?: string; submitLabel?: string }) {
  const [state, action, pending] = useActionState(setNewPassword, undefined);
  const [show, setShow] = useState(false);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="New password">
        <input name="password" type={show ? "text" : "password"} autoComplete="new-password" minLength={10} required className={inputCls} />
      </Field>
      <Field label="Type it again">
        <input name="confirm" type={show ? "text" : "password"} autoComplete="new-password" minLength={10} required className={inputCls} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-white/55">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="accent-signal" /> Show password
      </label>
      <p className="text-xs text-white/40">At least 10 characters. A short sentence works well.</p>
      <Status state={state} />
      <button disabled={pending} className={`${btnCls} w-full`}>{pending ? "Saving…" : submitLabel}</button>
    </form>
  );
}
