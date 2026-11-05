"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { callMeNow } from "@/app/actions/publicForms";
import { company } from "@/content/facts";

/**
 * "Call me now": one tap and Ken gets an instant alert to call this driver.
 * With a personal token (or a known contact) no typing is needed; otherwise asks for a phone number.
 */
export function CallMeNow({ token, phone: knownPhone, name, source, compact = false }: { token?: string | null; phone?: string | null; name?: string | null; source: "form" | "application" | "call_page" | "form_success"; compact?: boolean }) {
  const [phone, setPhone] = useState(knownPhone ?? "");
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ inHours?: boolean; error?: string } | null>(null);
  const known = !!token || !!knownPhone;

  async function go() {
    if (!known && !ask) return setAsk(true);
    setBusy(true);
    const r = await callMeNow({ token: token ?? null, phone: phone || null, name: name ?? null, source });
    setBusy(false);
    setRes(r.ok ? { inHours: r.inHours } : { error: r.error });
  }

  if (res && !res.error)
    return (
      <div className="rounded-[6px] border border-signal/40 bg-signal/[0.08] p-5">
        <p className="text-lg font-medium">{res.inHours ? "Ken's calling you in a few minutes." : "Ken will call you first thing in the morning."}</p>
        <p className="mt-1 text-white/70">He calls from <a href={`tel:${company.phone.e164}`} className="underline underline-offset-4">{company.phone.display}</a>. Save it so you pick up.</p>
        <a href={`tel:${company.phone.e164}`} className="mt-4 inline-flex h-12 items-center rounded-[4px] border border-white/20 px-5 text-sm text-white/85 hover:border-white">Or call Ken now</a>
      </div>
    );

  return (
    <div className={clsx(!compact && "rounded-[6px] border border-white/12 p-5")}>
      {!compact && <p className="font-medium">Rather talk to Ken?</p>}
      {!compact && <p className="mt-1 text-sm text-white/60">Tap below and Ken gets an alert to call you right away.</p>}
      {ask && !known && (
        <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="Your cell number" className="mt-4 h-14 w-full rounded-[4px] border border-white/15 bg-white/[0.03] px-4 text-base text-white placeholder:text-white/35 focus:border-white/50 focus:outline-none" />
      )}
      <button onClick={go} disabled={busy} className={clsx("flex h-14 w-full items-center justify-center gap-2 rounded-[4px] border border-white/25 text-base font-medium text-white transition-colors hover:border-white disabled:opacity-60", !compact && "mt-4")}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>
        {busy ? "Sending…" : ask && !known ? "Call me now" : "Call me now"}
      </button>
      {res?.error && <p className="mt-2 text-sm text-red-300">{res.error}</p>}
    </div>
  );
}
