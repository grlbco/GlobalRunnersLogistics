"use client";

import { useState, useTransition } from "react";
import { clsx } from "clsx";
import { saveCallHours, setSending } from "@/app/crm/settings/actions";
import { btnGhostCls, inputCls } from "./ui";

function Msg({ r }: { r: { ok: boolean; error?: string; message?: string } | null }) {
  if (!r) return null;
  return <p className={clsx("text-sm", r.ok ? "text-emerald-700" : "text-red-600")}>{r.ok ? r.message : r.error}</p>;
}

export function SendingSwitch({ on, envOn, canEdit }: { on: boolean; envOn: boolean; canEdit: boolean }) {
  const [state, setState] = useState(on);
  const [pending, start] = useTransition();
  const [r, setR] = useState<{ ok: boolean; error?: string; message?: string } | null>(null);
  const live = state && envOn;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <button
        disabled={!canEdit || pending}
        onClick={() => {
          if (state && !confirm("Stop ALL texts and emails right now? Nothing goes out until you turn it back on.")) return;
          start(async () => {
            const res = await setSending(!state);
            setR(res);
            if (res.ok) setState(!state);
          });
        }}
        aria-label={state ? "Stop all sending" : "Turn sending on"}
        className={clsx("relative h-12 w-24 shrink-0 rounded-full transition-colors disabled:opacity-50", state ? "bg-emerald-500" : "bg-red-50")}
      >
        <span className={clsx("absolute top-1 h-10 w-10 rounded-full bg-white shadow transition-all", state ? "left-[52px]" : "left-1")} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-xl font-semibold">{live ? "Sending is ON" : "All sending is OFF"}</p>
        <p className="mt-1 text-sm text-muted">
          {live
            ? "Texts, emails, follow-ups and the assistant's replies go out normally."
            : !envOn
              ? "Blocked by SENDING_ENABLED in the server settings, so this switch can't turn it on."
              : "Nothing leaves the CRM. Messages wait; when you turn it back on, anything older than 6 hours from the assistant is dropped."}
        </p>
        <Msg r={r} />
      </div>
    </div>
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ZONES = ["America/Los_Angeles", "America/Denver", "America/Phoenix", "America/Chicago", "America/New_York"];

export function CallHoursForm({ initial, canEdit }: { initial: { start: string; end: string; tz: string; days: number[] }; canEdit: boolean }) {
  const [h, setH] = useState(initial);
  const [pending, start] = useTransition();
  const [r, setR] = useState<{ ok: boolean; error?: string; message?: string } | null>(null);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <input type="time" value={h.start} onChange={(e) => setH({ ...h, start: e.target.value })} disabled={!canEdit} className={clsx(inputCls, "w-32")} aria-label="From" />
        <input type="time" value={h.end} onChange={(e) => setH({ ...h, end: e.target.value })} disabled={!canEdit} className={clsx(inputCls, "w-32")} aria-label="To" />
        <select value={h.tz} onChange={(e) => setH({ ...h, tz: e.target.value })} disabled={!canEdit} className={clsx(inputCls, "w-56")}>
          {ZONES.map((z) => <option key={z} value={z}>{z.replace("America/", "").replace("_", " ")} time</option>)}
        </select>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {DAYS.map((d, i) => (
          <button key={d} disabled={!canEdit} onClick={() => setH({ ...h, days: h.days.includes(i) ? h.days.filter((x) => x !== i) : [...h.days, i].sort() })} className={clsx("h-9 w-12 rounded-[10px] border text-xs", h.days.includes(i) ? "border-signal bg-signal-soft text-signal-ink" : "border-line text-faint")}>{d}</button>
        ))}
      </div>
      {canEdit && <button disabled={pending} onClick={() => start(async () => setR(await saveCallHours(h)))} className={btnGhostCls}>Save hours</button>}
      <Msg r={r} />
    </div>
  );
}
