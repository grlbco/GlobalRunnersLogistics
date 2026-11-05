"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { clsx } from "clsx";
import { PERMISSIONS, type Perm } from "@/lib/crm/permissions";
import { ago } from "@/lib/crm/format";
import { addMember, deleteRole, removeMember, resetMemberPassword, saveRole, setMemberStatus, updateMember, type TeamResult } from "@/app/crm/team/actions";
import { Card, Label, btnCls, btnGhostCls, inputCls } from "@/components/crm/ui";

export type TeamRole = { key: string; name: string; description: string | null; isSystem: boolean; perms: Perm[]; all: boolean; count: number };
export type TeamMember = {
  id: string; name: string; email: string; role: string; status: "active" | "suspended"; perms: Perm[];
  grant: string[]; deny: string[]; pendingPassword: boolean; lastSeen: string | null; addedAt: string;
};
export type TeamAudit = { id: number; at: string; action: string; actor: string; target: string | null; role: string | null };
type Me = { id: string; perms: Perm[]; isAdmin: boolean };

const GROUPS = [...new Set(PERMISSIONS.map((p) => p.group))];

function Msg({ r }: { r: TeamResult | null }) {
  if (!r) return null;
  return <p role={r.ok ? "status" : "alert"} className={clsx("text-sm", r.ok ? "text-emerald-700" : "text-red-600")}>{r.ok ? r.message : r.error}</p>;
}

/** A temporary password is shown exactly once. */
function Secret({ password, who, onClose }: { password: string; who: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-[10px] border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm text-amber-700">Temporary password for {who}. It won&apos;t be shown again. Send it privately (not in the same message as the email address). They&apos;ll be asked to choose their own at first sign-in at <span className="font-mono">/crm/login</span>.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="rounded-[7px] bg-hover px-3 py-2 font-mono text-[0.95rem] tracking-wide">{password}</code>
        <button type="button" className={btnGhostCls} onClick={async () => { await navigator.clipboard.writeText(password); setCopied(true); }}>{copied ? "Copied" : "Copy"}</button>
        <button type="button" className="text-sm text-faint hover:text-fg" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

/** Grouped checklist. `base` marks what comes from the role; locked boxes are permissions the editor doesn't have. */
function PermChecklist({ value, onChange, base, mine, disabled }: { value: Perm[]; onChange: (v: Perm[]) => void; base?: Perm[]; mine: Perm[]; disabled?: boolean }) {
  const toggle = (k: Perm) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  return (
    <div className="grid gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
      {GROUPS.map((g) => (
        <fieldset key={g}>
          <legend className="text-[0.8rem] font-medium text-fg-2">{g}</legend>
          <div className="mt-2 space-y-1.5">
            {PERMISSIONS.filter((p) => p.group === g).map((p) => {
              const on = value.includes(p.key);
              const fromRole = base?.includes(p.key);
              const locked = disabled || !mine.includes(p.key);
              const tag = base ? (on && !fromRole ? "extra" : !on && fromRole ? "removed" : null) : null;
              return (
                <label key={p.key} className={clsx("flex items-start gap-2.5 text-sm", locked ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
                  <input type="checkbox" className="mt-[3px] accent-signal" checked={on} disabled={locked} onChange={() => toggle(p.key)} />
                  <span className="text-fg-2">
                    {p.label}
                    {tag && <span className={clsx("ml-2 rounded-full px-1.5 py-px font-mono text-[0.6rem] uppercase tracking-wider", tag === "extra" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600")}>{tag}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

// ─── people ─────────────────────────────────────────────────────────────────

function AddPerson({ roles, me, onClose }: { roles: TeamRole[]; me: Me; onClose: () => void }) {
  const giveable = roles.filter((r) => r.perms.every((p) => me.perms.includes(p)));
  const [f, setF] = useState({ name: "", email: "", role: giveable.find((r) => r.key === "recruiter")?.key ?? giveable[0]?.key ?? "" });
  const [res, setRes] = useState<TeamResult | null>(null);
  const [pending, start] = useTransition();
  if (res?.ok && res.password) return <Secret password={res.password} who={f.name} onClose={onClose} />;
  return (
    <Card className="p-5">
      <Label>Add a person</Label>
      <form
        className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_12rem_auto]"
        onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await addMember(f); setRes(r); if (r.ok && !r.password) onClose(); }); }}
      >
        <input required placeholder="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} />
        <input required type="email" placeholder="Work email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={inputCls} />
        <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} className={inputCls}>
          {giveable.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
        </select>
        <div className="flex gap-2">
          <button disabled={pending} className={btnCls}>{pending ? "Adding…" : "Add"}</button>
          <button type="button" onClick={onClose} className={btnGhostCls}>Cancel</button>
        </div>
      </form>
      <p className="mt-3 text-xs text-faint">They get a temporary password (shown once here) and must choose their own the first time they sign in. You can fine-tune their permissions after adding them.</p>
      <div className="mt-2"><Msg r={res} /></div>
    </Card>
  );
}

function MemberEditor({ m, roles, me, onSecret }: { m: TeamMember; roles: TeamRole[]; me: Me; onSecret: (pw: string) => void }) {
  const [role, setRole] = useState(m.role);
  const [perms, setPerms] = useState<Perm[]>(m.perms);
  const [res, setRes] = useState<TeamResult | null>(null);
  const [pending, start] = useTransition();
  const roleBase = roles.find((r) => r.key === role)?.perms ?? [];
  const dirty = role !== m.role || perms.join() !== m.perms.join();
  const run = (fn: () => Promise<TeamResult>) => start(async () => { const r = await fn(); setRes(r); if (r.ok && r.password) onSecret(r.password); });

  if (m.id === me.id) return <p className="text-sm text-faint">This is you. Someone else on the team has to change your access. Your password is on <Link href="/crm/account" className="underline underline-offset-4">My account</Link>.</p>;
  const above = m.perms.some((p) => !me.perms.includes(p));
  if (above) return <p className="text-sm text-faint">{m.name} has access you don&apos;t have, so only someone above you can change them.</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1.5 block text-[0.8rem] text-muted">Role</span>
          <select
            value={role}
            onChange={(e) => { const r = roles.find((x) => x.key === e.target.value); setRole(e.target.value); setPerms(r?.perms ?? []); }}
            className={clsx(inputCls, "w-56")}
          >
            {roles.map((r) => <option key={r.key} value={r.key} disabled={!r.perms.every((p) => me.perms.includes(p))}>{r.name}</option>)}
          </select>
        </label>
        <p className="pb-2.5 text-xs text-faint">Picking a role resets the checklist to that role. Then tick or untick to give extra or remove single permissions for this person only.</p>
      </div>
      <PermChecklist value={perms} onChange={setPerms} base={roleBase} mine={me.perms} />
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <button disabled={pending || !dirty} onClick={() => run(() => updateMember({ id: m.id, role, perms }))} className={btnCls}>Save access</button>
        <button disabled={pending} onClick={() => confirm(`Give ${m.name} a new temporary password? Their current password stops working.`) && run(() => resetMemberPassword({ id: m.id }))} className={btnGhostCls}>Reset password</button>
        {m.status === "active"
          ? <button disabled={pending} onClick={() => confirm(`Suspend ${m.name}? They're signed out of the CRM right away.`) && run(() => setMemberStatus({ id: m.id, status: "suspended" }))} className={btnGhostCls}>Suspend</button>
          : <button disabled={pending} onClick={() => run(() => setMemberStatus({ id: m.id, status: "active" }))} className={btnGhostCls}>Reactivate</button>}
        <button disabled={pending} onClick={() => confirm(`Remove ${m.name}'s CRM access? Their login stays, but they can't open the CRM.`) && run(() => removeMember({ id: m.id }))} className="ml-auto text-sm text-red-600 hover:text-red-600">Remove access</button>
      </div>
      <Msg r={res} />
    </div>
  );
}

function People({ members, roles, me }: { members: TeamMember[]; roles: TeamRole[]; me: Me }) {
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [secret, setSecret] = useState<{ pw: string; who: string } | null>(null);
  const roleName = (k: string) => roles.find((r) => r.key === k)?.name ?? k;
  return (
    <div className="space-y-4">
      {secret && <Secret password={secret.pw} who={secret.who} onClose={() => setSecret(null)} />}
      {adding ? <AddPerson roles={roles} me={me} onClose={() => setAdding(false)} /> : (
        <div className="flex justify-end"><button onClick={() => setAdding(true)} className={btnCls}>Add a person</button></div>
      )}
      <Card>
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.id}>
              <button onClick={() => setOpen(open === m.id ? null : m.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 text-left hover:bg-subtle">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{m.name}{m.id === me.id && <span className="ml-2 text-xs text-faint">(you)</span>}</span>
                  <span className="block truncate text-sm text-faint">{m.email}</span>
                </span>
                <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-fg-2">{roleName(m.role)}{(m.grant.length > 0 || m.deny.length > 0) && " · custom"}</span>
                <span className={clsx("w-24 text-xs", m.status === "active" ? "text-emerald-700/90" : "text-red-600")}>{m.status === "active" ? (m.pendingPassword ? "Invited" : "Active") : "Suspended"}</span>
                <span className="w-28 text-right text-xs text-faint">{m.lastSeen ? `Seen ${ago(m.lastSeen)} ago` : "Never signed in"}</span>
              </button>
              {open === m.id && (
                <div className="border-t border-line bg-subtle px-5 py-5">
                  <MemberEditor m={m} roles={roles} me={me} onSecret={(pw) => setSecret({ pw, who: m.name })} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// ─── roles ──────────────────────────────────────────────────────────────────

function RoleEditor({ role, roles, me, onDone }: { role?: TeamRole; roles: TeamRole[]; me: Me; onDone?: () => void }) {
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [perms, setPerms] = useState<Perm[]>(role?.perms ?? roles.find((r) => r.key === "viewer")?.perms ?? []);
  const [res, setRes] = useState<TeamResult | null>(null);
  const [pending, start] = useTransition();
  const fixed = role?.all;
  const canEdit = me.isAdmin && !fixed;
  return (
    <div className="space-y-4">
      {fixed && <p className="text-sm text-faint">The Admin role always has every permission, including ones added later. It can&apos;t be changed.</p>}
      {!me.isAdmin && <p className="text-sm text-faint">Only Admins can change roles. You can still give or remove single permissions for a person on the People tab.</p>}
      {canEdit && (
        <div className="grid gap-3 md:grid-cols-[16rem_1fr]">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Role name, e.g. Night dispatcher" className={inputCls} />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this role is for (optional)" className={inputCls} />
        </div>
      )}
      {!role && canEdit && (
        <label className="flex items-center gap-2 text-sm text-muted">
          Start from
          <select className={clsx(inputCls, "w-48")} defaultValue="viewer" onChange={(e) => setPerms(roles.find((r) => r.key === e.target.value)?.perms ?? [])}>
            {roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
          </select>
        </label>
      )}
      <PermChecklist value={perms} onChange={setPerms} mine={me.perms} disabled={!canEdit} />
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <button disabled={pending || !name.trim()} className={btnCls}
            onClick={() => start(async () => { const r = await saveRole({ key: role?.key, name, description, perms }); setRes(r); if (r.ok && !role) onDone?.(); })}>
            {role ? "Save role" : "Create role"}
          </button>
          {role && !role.isSystem && (
            <button disabled={pending} className="ml-auto text-sm text-red-600 hover:text-red-600"
              onClick={() => confirm(`Delete the ${role.name} role?`) && start(async () => setRes(await deleteRole({ key: role.key })))}>Delete role</button>
          )}
          {!role && <button type="button" onClick={onDone} className={btnGhostCls}>Cancel</button>}
        </div>
      )}
      <Msg r={res} />
    </div>
  );
}

function Roles({ roles, me }: { roles: TeamRole[]; me: Me }) {
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  return (
    <div className="space-y-4">
      {me.isAdmin && !creating && <div className="flex justify-end"><button onClick={() => setCreating(true)} className={btnCls}>New role</button></div>}
      {creating && (
        <Card className="p-5">
          <Label>New role</Label>
          <div className="mt-4"><RoleEditor roles={roles} me={me} onDone={() => setCreating(false)} /></div>
        </Card>
      )}
      <Card>
        <ul className="divide-y divide-line">
          {roles.map((r) => (
            <li key={r.key}>
              <button onClick={() => setOpen(open === r.key ? null : r.key)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 text-left hover:bg-subtle">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{r.name}{r.isSystem && <span className="ml-2 font-mono text-[0.6rem] uppercase tracking-wider text-ghost">built-in</span>}</span>
                  {r.description && <span className="block text-sm text-faint">{r.description}</span>}
                </span>
                <span className="text-xs text-faint">{r.all ? "Everything" : `${r.perms.length} of ${PERMISSIONS.length} permissions`}</span>
                <span className="w-24 text-right text-xs text-faint">{r.count} {r.count === 1 ? "person" : "people"}</span>
              </button>
              {open === r.key && <div className="border-t border-line bg-subtle px-5 py-5"><RoleEditor role={r} roles={roles} me={me} /></div>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// ─── activity ───────────────────────────────────────────────────────────────

const ACTION_TEXT: Record<string, string> = {
  member_added: "added", member_updated: "changed the access of", member_suspended: "suspended", member_reactivated: "reactivated",
  member_removed: "removed the access of", password_reset_by_admin: "reset the password of", role_created: "created the role",
  role_updated: "changed the role", role_deleted: "deleted the role", signed_in: "signed in", password_changed: "changed their password",
  password_reset_requested: "asked for a password reset link",
};

function Activity({ log }: { log: TeamAudit[] }) {
  if (!log.length) return <Card className="p-8 text-center text-sm text-faint">Nothing yet. Sign-ins and every change to the team show up here.</Card>;
  return (
    <Card>
      <ul className="divide-y divide-line">
        {log.map((a) => {
          const self = ["signed_in", "password_changed", "password_reset_requested"].includes(a.action);
          const roleAction = a.action.startsWith("role_");
          return (
            <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 px-5 py-3 text-sm">
              <span className="text-fg-2">
                {a.actor} {ACTION_TEXT[a.action] ?? a.action.replace(/_/g, " ")}
                {!self && !roleAction && a.target && <> {a.target}</>}
                {roleAction && a.role && <> <span className="font-mono text-muted">{a.role}</span></>}
                {a.action === "member_added" && a.role && <> as <span className="font-mono text-muted">{a.role}</span></>}
              </span>
              <span className="ml-auto text-xs text-faint">{new Date(a.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function TeamManager({ me, members, roles, log }: { me: Me; members: TeamMember[]; roles: TeamRole[]; log: TeamAudit[] }) {
  const [tab, setTab] = useState<"people" | "roles" | "activity">("people");
  const counts = useMemo(() => ({ people: members.length, roles: roles.length }), [members, roles]);
  const tabs = [
    { k: "people" as const, label: `People · ${counts.people}` },
    { k: "roles" as const, label: `Roles · ${counts.roles}` },
    { k: "activity" as const, label: "Activity" },
  ];
  return (
    <div className="space-y-5 p-5 md:p-8">
      <div role="tablist" className="flex gap-1 border-b border-line">
        {tabs.map((t) => (
          <button key={t.k} role="tab" aria-selected={tab === t.k} onClick={() => setTab(t.k)}
            className={clsx("-mb-px border-b-2 px-3 py-2.5 text-sm transition-colors", tab === t.k ? "border-signal text-fg" : "border-transparent text-faint hover:text-fg")}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "people" && <People members={members} roles={roles} me={me} />}
      {tab === "roles" && <Roles roles={roles} me={me} />}
      {tab === "activity" && <Activity log={log} />}
    </div>
  );
}
