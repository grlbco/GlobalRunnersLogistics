"use client";

import { useState, useTransition } from "react";
import { clsx } from "clsx";
import { addLeadsWave, createInInstantly, refreshStats, setCampaignState } from "@/app/crm/campaigns/actions";
import { TIERS } from "@/lib/crm/stages";
import { Card, Label, btnCls, btnGhostCls, inputCls } from "./ui";

type Res = { ok: boolean; message: string } | null;

export function CampaignControls({ id, created, status, leadsAdded, available }: { id: string; created: boolean; status: string; leadsAdded: number; available: Record<number, number> }) {
  const [msg, setMsg] = useState<Res>(null);
  const [busy, start] = useTransition();
  const [tiers, setTiers] = useState<number[]>([1]);
  const [states, setStates] = useState("");
  const [count, setCount] = useState(200);
  const run = (fn: () => Promise<Res>) => start(async () => setMsg(await fn()));

  return (
    <Card className="space-y-5 p-5">
      <Label>Launch</Label>
      {!created ? (
        <div className="space-y-2">
          <p className="text-sm text-muted">Save your draft, then create it in Instantly. It stays paused until you activate it.</p>
          <button disabled={busy} onClick={() => run(() => createInInstantly(id))} className={clsx(btnCls, "w-full")}>Create in Instantly</button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <p className="text-sm font-medium">Add a wave of leads</p>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5].map((t) => (
                <button key={t} type="button" onClick={() => setTiers(tiers.includes(t) ? tiers.filter((x) => x !== t) : [...tiers, t])} className={clsx("rounded-full px-2.5 py-1 text-xs", tiers.includes(t) ? "bg-fg text-surface" : "bg-hover text-muted")} title={TIERS[t]}>
                  Tier {t} · {(available[t] ?? 0).toLocaleString("en-US")}
                </button>
              ))}
            </div>
            <input value={states} onChange={(e) => setStates(e.target.value.toUpperCase())} placeholder="States (optional), e.g. NV, AZ, CA" className={inputCls} />
            <div className="flex gap-2">
              <input type="number" min={1} max={5000} value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} className={clsx(inputCls, "w-28")} />
              <button disabled={busy || !tiers.length} onClick={() => run(() => addLeadsWave(id, tiers, states.split(/[\s,]+/).filter((x) => x.length === 2), count))} className={clsx(btnGhostCls, "flex-1")}>Add leads</button>
            </div>
            <p className="text-xs text-faint">Only drivers still at &quot;New&quot;, with an email, not opted out, and not in another campaign. {leadsAdded.toLocaleString("en-US")} added so far.</p>
          </div>
          <div className="flex gap-2 border-t border-line pt-4">
            {status === "active" ? (
              <button disabled={busy} onClick={() => run(() => setCampaignState(id, "pause"))} className={clsx(btnGhostCls, "flex-1")}>Pause</button>
            ) : (
              <button disabled={busy || !leadsAdded} onClick={() => confirm("Start sending real emails to the leads in this campaign?") && run(() => setCampaignState(id, "activate"))} className={clsx(btnCls, "flex-1")}>Activate</button>
            )}
            <button disabled={busy} onClick={() => run(() => refreshStats(id))} className={btnGhostCls}>Refresh stats</button>
          </div>
        </>
      )}
      {msg && <p className={clsx("text-sm", msg.ok ? "text-emerald-700" : "text-red-600")}>{msg.message}</p>}
    </Card>
  );
}
