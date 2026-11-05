"use client";

import { useState, useTransition } from "react";
import { saveCosts } from "@/app/crm/reports/actions";
import { btnGhostCls, inputCls } from "./ui";

const LABELS: Record<string, string> = { instantly: "Instantly", quo: "Quo", leads: "Lead data", other: "Other" };

export function CostsForm({ initial, canEdit }: { initial: Record<string, number>; canEdit: boolean }) {
  const [c, setC] = useState(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {Object.keys(LABELS).map((k) => (
          <label key={k} className="block text-xs text-white/50">{LABELS[k]} ($/month)
            <input type="number" min={0} value={c[k] ?? 0} disabled={!canEdit} onChange={(e) => setC({ ...c, [k]: Number(e.target.value) })} className={`${inputCls} mt-1`} />
          </label>
        ))}
      </div>
      {canEdit && <button disabled={pending} onClick={() => start(async () => setMsg((await saveCosts(c)).ok ? "Saved" : "Couldn't save"))} className={btnGhostCls}>Save costs</button>}
      {msg && <p className="text-sm text-emerald-300">{msg}</p>}
    </div>
  );
}
