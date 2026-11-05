"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";
import { crmForgotPassword, crmSignIn, setNewPassword, type FormState } from "@/app/crm/auth-actions";
import { btnCls, inputCls } from "@/components/crm/ui";

export function AuthShell({ title, sub, children, footer }: { title: string; sub?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="bg-dots relative grid min-h-[calc(100dvh-1rem)] w-full place-items-center overflow-hidden px-5 py-12 md:rounded-[12px]">
      {/* soft brand glow behind the card */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(232_64_28/0.07),transparent)]" />
      <div className="relative w-full max-w-[400px]">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-line bg-surface shadow-card">
            <Image src="/brand/mark-navy.png" alt="" width={22} height={22} className="h-[22px] w-[22px]" />
          </span>
          <span>
            <span className="block text-[0.95rem] font-semibold leading-tight tracking-[-0.02em]">Command</span>
            <span className="block text-[0.72rem] leading-tight text-faint">Global Runners Logistics</span>
          </span>
        </div>
        <div className="rounded-[14px] border border-line bg-surface p-7 shadow-pop">
          <h1 className="text-[1.25rem] font-semibold tracking-[-0.025em]">{title}</h1>
          {sub && <p className="mt-1.5 text-[0.875rem] leading-relaxed text-muted">{sub}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.8rem] font-medium text-fg-2">{label}</span>
      {children}
    </label>
  );
}

function Status({ state }: { state: FormState }) {
  if (!state) return null;
  return (
    <p role={state.error ? "alert" : "status"} className={state.error ? "text-sm text-red-600" : "text-sm text-emerald-700"}>
      {state.error ?? state.message}
    </p>
  );
}

export function SignInForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action, pending] = useActionState(crmSignIn, undefined);
  return (
    <form action={action} className="space-y-4">
      {notice && <p className="rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p>}
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
        <Link href="/crm/forgot" className="text-muted underline-offset-4 hover:text-fg hover:underline">Forgot password?</Link>
        <span className="text-ghost">Access by invitation only</span>
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
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="accent-signal" /> Show password
      </label>
      <p className="text-xs text-faint">At least 10 characters. A short sentence works well.</p>
      <Status state={state} />
      <button disabled={pending} className={`${btnCls} w-full`}>{pending ? "Saving…" : submitLabel}</button>
    </form>
  );
}
