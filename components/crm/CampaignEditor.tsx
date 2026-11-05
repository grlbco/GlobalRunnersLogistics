"use client";

import { useState, useTransition } from "react";
import { clsx } from "clsx";
import { saveCampaign } from "@/app/crm/campaigns/actions";
import type { CampaignSettings, SeqStep } from "@/lib/crm/campaigns";
import { TIERS } from "@/lib/crm/stages";
import { Card, Label, btnCls, btnGhostCls, inputCls } from "./ui";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LETTERS = "ABCDE";

export function CampaignEditor({ id, initial, accounts, locked }: { id: string; initial: { name: string; sequence: SeqStep[]; settings: CampaignSettings }; accounts: string[]; locked: boolean }) {
  const [name, setName] = useState(initial.name);
  const [seq, setSeq] = useState<SeqStep[]>(initial.sequence);
  const [s, setS] = useState<CampaignSettings>(initial.settings);
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, start] = useTransition();
  const dirty = () => setMsg(null);
  const upStep = (i: number, patch: Partial<SeqStep>) => (dirty(), setSeq((q) => q.map((x, j) => (j === i ? { ...x, ...patch } : x))));
  const upVar = (i: number, v: number, patch: { subject?: string; body?: string }) => upStep(i, { variants: seq[i].variants.map((x, k) => (k === v ? { ...x, ...patch } : x)) });

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-5">
        <input value={name} onChange={(e) => (dirty(), setName(e.target.value))} disabled={locked} className={clsx(inputCls, "text-base font-medium")} />
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Send from</Label>
            {accounts.length ? (
              <div className="mt-2 space-y-1.5">
                {accounts.map((a) => (
                  <label key={a} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" disabled={locked} checked={s.accounts.includes(a)} onChange={(e) => (dirty(), setS({ ...s, accounts: e.target.checked ? [...s.accounts, a] : s.accounts.filter((x) => x !== a) }))} className="h-4 w-4 accent-[#e8401c]" />
                    {a}
                  </label>
                ))}
              </div>
            ) : <p className="mt-2 text-sm text-[#8a4f0e]">No sending inboxes found in Instantly.</p>}
            <label className="mt-3 flex items-center gap-2 text-sm">Max emails / inbox / day <input type="number" min={1} max={1000} value={s.daily_limit} disabled={locked} onChange={(e) => (dirty(), setS({ ...s, daily_limit: Number(e.target.value) || 1 }))} className={clsx(inputCls, "w-24")} /></label>
          </div>
          <div>
            <Label>Schedule</Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {DAYS.map((d, i) => (
                <button key={d} type="button" disabled={locked} onClick={() => (dirty(), setS({ ...s, days: s.days.includes(i) ? s.days.filter((x) => x !== i) : [...s.days, i].sort() }))} className={clsx("rounded-full px-2.5 py-1 text-xs", s.days.includes(i) ? "bg-fg text-white" : "bg-hover text-muted")}>{d}</button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <input type="time" value={s.from} disabled={locked} onChange={(e) => (dirty(), setS({ ...s, from: e.target.value }))} className={clsx(inputCls, "w-32")} /> to
              <input type="time" value={s.to} disabled={locked} onChange={(e) => (dirty(), setS({ ...s, to: e.target.value }))} className={clsx(inputCls, "w-32")} />
              <select value={s.timezone} disabled={locked} onChange={(e) => (dirty(), setS({ ...s, timezone: e.target.value }))} className={clsx(inputCls, "w-48")}>
                <option value="America/Chicago">Central</option>
                <option value="America/Detroit">Eastern</option>
                <option value="America/Boise">Mountain</option>
                <option value="America/Anchorage">Alaska</option>
                <option value="America/Dawson">Pacific</option>
              </select>
            </div>
            <p className="mt-3 text-xs text-faint">Target tiers for waves: {(s.tiers ?? []).map((t) => `${t} · ${TIERS[t]}`).join(", ") || "all"}</p>
          </div>
        </div>
      </Card>

      {seq.map((step, i) => (
        <Card key={i} className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-medium">Email {i + 1}</p>
            <div className="flex items-center gap-3 text-sm text-muted">
              {i > 0 && <label className="flex items-center gap-2">send <input type="number" min={1} max={30} value={step.delay_days} disabled={locked} onChange={(e) => upStep(i, { delay_days: Number(e.target.value) || 1 })} className={clsx(inputCls, "w-16")} /> days after the previous one</label>}
              {!locked && seq.length > 1 && <button type="button" onClick={() => (dirty(), setSeq(seq.filter((_, j) => j !== i)))} className="hover:text-red-600">Remove</button>}
            </div>
          </div>
          <div className={clsx("mt-4 grid gap-4", step.variants.length > 1 && "xl:grid-cols-2")}>
            {step.variants.map((v, k) => (
              <div key={k} className="space-y-2 rounded-[10px] border border-line p-3">
                <div className="flex items-center justify-between text-xs text-faint">
                  <span>Version {LETTERS[k]}</span>
                  {!locked && step.variants.length > 1 && <button type="button" onClick={() => upStep(i, { variants: step.variants.filter((_, x) => x !== k) })} className="hover:text-red-600">Remove</button>}
                </div>
                <input value={v.subject} onChange={(e) => upVar(i, k, { subject: e.target.value })} disabled={locked} placeholder={i === 0 ? "Subject" : "Subject (empty = reply in same thread)"} className={inputCls} />
                <textarea value={v.body} onChange={(e) => upVar(i, k, { body: e.target.value })} disabled={locked} rows={9} className={clsx(inputCls, "h-auto py-2 font-mono text-[0.8rem] leading-relaxed")} />
              </div>
            ))}
          </div>
          {!locked && step.variants.length < 5 && <button type="button" onClick={() => upStep(i, { variants: [...step.variants, { subject: step.variants[0]?.subject ?? "", body: step.variants[0]?.body ?? "" }] })} className="mt-3 text-sm text-muted hover:text-fg">+ Add version {LETTERS[step.variants.length]}</button>}
        </Card>
      ))}

      {!locked && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => (dirty(), setSeq([...seq, { delay_days: 3, variants: [{ subject: "", body: "Hi {{firstName}},\n\n" }] }]))} className={btnGhostCls}>+ Add email</button>
          <button type="button" disabled={busy} onClick={() => start(async () => setMsg(await saveCampaign({ id, name, sequence: seq, settings: s })))} className={btnCls}>{busy ? "Saving…" : "Save draft"}</button>
          {msg && <span className={clsx("text-sm", msg.ok ? "text-emerald-700" : "text-red-600")}>{msg.message}</span>}
        </div>
      )}
      <p className="text-xs text-faint">Variables: {"{{firstName}} {{lastName}} {{companyName}} {{city}} {{state}}"} · Keep pay rates out until Ken confirms them. Each email ends with the office address and a reply-stop line (CAN-SPAM).</p>
    </div>
  );
}
