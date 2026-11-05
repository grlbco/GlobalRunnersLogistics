"use client";

import { useState, useTransition } from "react";
import { clsx } from "clsx";
import { addTeamMember, changeMyPassword, saveCallHours, setRole, setSending } from "@/app/crm/settings/actions";
import { ago } from "@/lib/crm/format";
import { btnCls, btnGhostCls, inputCls } from "./ui";

function Msg({ r }: { r: { ok: boolean; error?: string; message?: string } | null }) {
  if (!r) return null;
  return <p className={clsx("text-sm", r.ok ? "text-emerald-300" : "text-red-300")}>{r.ok ? r.message : r.error}</p>;
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
        className={clsx("relative h-12 w-24 shrink-0 rounded-full transition-colors disabled:opacity-50", state ? "bg-emerald-500" : "bg-red-500/80")}
      >
        <span className={clsx("absolute top-1 h-10 w-10 rounded-full bg-white shadow transition-all", state ? "left-[52px]" : "left-1")} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-xl font-semibold">{live ? "Sending is ON" : "All sending is OFF"}</p>
        <p className="mt-1 text-sm text-white/55">
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
          <button key={d} disabled={!canEdit} onClick={() => setH({ ...h, days: h.days.includes(i) ? h.days.filter((x) => x !== i) : [...h.days, i].sort() })} className={clsx("h-9 w-12 rounded-[4px] border text-xs", h.days.includes(i) ? "border-signal bg-signal/15 text-white" : "border-white/12 text-white/45")}>{d}</button>
        ))}
      </div>
      {canEdit && <button disabled={pending} onClick={() => start(async () => setR(await saveCallHours(h)))} className={btnGhostCls}>Save hours</button>}
      <Msg r={r} />
    </div>
  );
}

export function PasswordForm() {
  const [p, setP] = useState({ password: "", confirm: "" });
  const [pending, start] = useTransition();
  const [r, setR] = useState<{ ok: boolean; error?: string; message?: string } | null>(null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await changeMyPassword(p);
          setR(res);
          if (res.ok) setP({ password: "", confirm: "" });
        });
      }}
      className="space-y-3"
    >
      <input type="password" autoComplete="new-password" placeholder="New password (10+ characters)" value={p.password} onChange={(e) => setP({ ...p, password: e.target.value })} className={inputCls} />
      <input type="password" autoComplete="new-password" placeholder="Type it again" value={p.confirm} onChange={(e) => setP({ ...p, confirm: e.target.value })} className={inputCls} />
      <button disabled={pending || !p.password} className={btnGhostCls}>Change password</button>
      <Msg r={r} />
    </form>
  );
}

type Member = { id: string; name: string; email: string; role: "recruiter" | "admin"; lastSeen: string | null };
export function TeamPanel({ members, me, canEdit }: { members: Member[]; me: string; canEdit: boolean }) {
  const [n, setN] = useState({ name: "", email: "", role: "recruiter" as "recruiter" | "admin" });
  const [pending, start] = useTransition();
  const [r, setR] = useState<{ ok: boolean; error?: string; message?: string; password?: string } | null>(null);
  return (
    <div className="space-y-5">
      <ul className="divide-y divide-white/[0.06] text-sm">
        {members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
            <span className="w-44 font-medium">{m.name || "—"}{m.id === me && <span className="ml-2 text-xs text-white/40">(you)</span>}</span>
            <span className="flex-1 text-white/60">{m.email}</span>
            <span className="w-32 text-xs text-white/40">{m.lastSeen ? `seen ${ago(m.lastSeen)}` : "never signed in"}</span>
            {canEdit && m.id !== me ? (
              <select
                value={m.role}
                onChange={(e) => {
                  const role = e.target.value as "recruiter" | "admin" | "remove";
                  if (role === "remove" && !confirm(`Remove ${m.name || m.email}'s access to the CRM?`)) return;
                  start(async () => setR(await setRole({ id: m.id, role })));
                }}
                className={clsx(inputCls, "h-9 w-36")}
              >
                <option value="recruiter">Recruiter</option>
                <option value="admin">Admin</option>
                <option value="remove">Remove access</option>
              </select>
            ) : (
              <span className="w-36 text-xs capitalize text-white/60">{m.role}</span>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await addTeamMember(n);
              setR(res);
              if (res.ok) setN({ name: "", email: "", role: "recruiter" });
            });
          }}
          className="flex flex-wrap items-end gap-3 rounded-[6px] border border-white/[0.08] p-4"
        >
          <input placeholder="Name (e.g. Ken Aman)" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} className={clsx(inputCls, "w-52")} />
          <input placeholder="Email" type="email" value={n.email} onChange={(e) => setN({ ...n, email: e.target.value })} className={clsx(inputCls, "w-64")} />
          <select value={n.role} onChange={(e) => setN({ ...n, role: e.target.value as "recruiter" | "admin" })} className={clsx(inputCls, "w-36")}>
            <option value="recruiter">Recruiter</option>
            <option value="admin">Admin</option>
          </select>
          <button disabled={pending || !n.email || !n.name} className={btnCls}>Add to team</button>
          <p className="w-full text-xs text-white/40">Recruiters work leads. Admins can also change automations, settings and the team.</p>
        </form>
      )}
      {r && (
        <div className="space-y-1">
          <Msg r={r} />
          {r.password && (
            <p className="text-sm">Temporary password: <code className="select-all rounded bg-white/10 px-2 py-1 font-mono">{r.password}</code> <span className="text-white/40">(shown once)</span></p>
          )}
        </div>
      )}
    </div>
  );
}
