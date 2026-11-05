"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";
import { crmForgotPassword, crmSignIn, setNewPassword, type FormState } from "@/app/crm/auth-actions";
import { motion } from "motion/react";
import { btnCls, inputCls } from "@/components/crm/ui";
import { BrandTile } from "@/components/crm/BrandTile";

export function AuthShell({ title, sub, children, footer }: { title: string; sub?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh w-full gap-3 p-3 lg:grid-cols-2">
      <div className="flex items-center justify-center rounded-[20px] border border-line bg-surface px-5 py-12">
        <motion.div className="w-full max-w-[380px]" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
          <BrandTile size="lg" />
          <h1 className="mt-7 text-[1.75rem] font-medium tracking-[-0.03em]">{title}</h1>
          {sub && <p className="mt-1.5 text-[0.9rem] leading-relaxed text-muted">{sub}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-5 text-sm text-muted">{footer}</div>}
        </motion.div>
      </div>
      <div aria-hidden className="relative hidden overflow-hidden rounded-[20px] bg-[#121415] lg:block">
        <Image src="/brand/mark-white.png" alt="" width={900} height={900} priority className="absolute -bottom-[18%] -right-[18%] w-[82%] max-w-none opacity-[0.09]" />
        <div className="absolute left-12 top-12 max-w-md">
          <Image src="/brand/mark-white.png" alt="" width={44} height={44} loading="eager" />
          <p className="mt-8 text-[2.25rem] font-medium leading-[1.1] tracking-[-0.03em] text-white">Every driver conversation, in one place.</p>
          <p className="mt-4 text-[0.95rem] leading-relaxed text-white/55">Replies, forms, follow-ups and hand-offs to Ken for Global Runners Logistics.</p>
        </div>
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
      {notice && <p className="rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p>}
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
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="accent-fg" /> Show password
      </label>
      <p className="text-xs text-faint">At least 10 characters. A short sentence works well.</p>
      <Status state={state} />
      <button disabled={pending} className={`${btnCls} w-full`}>{pending ? "Saving…" : submitLabel}</button>
    </form>
  );
}
