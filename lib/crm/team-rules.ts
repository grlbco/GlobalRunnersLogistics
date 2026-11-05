/**
 * Safety rules for changing who has CRM access. Pure functions, unit-tested.
 * 1. You can only hand out permissions you have yourself (no promoting someone above you).
 * 2. You can't change your own access (someone else has to).
 * 3. There must always be at least one active person who can manage the team.
 */
import { effectivePerms, type Perm } from "./permissions";

export type RoleRow = { key: string; name: string; permissions: string[] };
export type MemberRow = { id: string; crm_role: string | null; staff_status: string; permissions_grant: string[]; permissions_deny: string[] };

export function permsOf(m: MemberRow, roles: RoleRow[]): Perm[] {
  if (!m.crm_role || m.staff_status !== "active") return [];
  const role = roles.find((r) => r.key === m.crm_role);
  return effectivePerms(role?.permissions, m.permissions_grant, m.permissions_deny);
}

/** Permissions in `wanted` that the actor doesn't have. Empty = allowed. */
export function beyondActor(actorPerms: readonly string[], wanted: readonly string[]): string[] {
  return wanted.filter((p) => !actorPerms.includes(p));
}

/** How many active members could still manage the team after a change. */
export function managersAfter(members: MemberRow[], roles: RoleRow[], change?: { member?: MemberRow; roles?: RoleRow[] }): number {
  const rs = change?.roles ?? roles;
  const ms = change?.member ? members.map((m) => (m.id === change.member!.id ? change.member! : m)) : members;
  if (change?.member && !ms.some((m) => m.id === change.member!.id)) ms.push(change.member);
  return ms.filter((m) => permsOf(m, rs).includes("team.manage")).length;
}

/** Turn a checklist into role-relative extras/removals so a later role change still applies cleanly. */
export function overridesFor(rolePerms: readonly string[] | undefined, checked: readonly string[]): { grant: Perm[]; deny: Perm[] } {
  const base = effectivePerms(rolePerms);
  const want = effectivePerms(checked);
  return { grant: want.filter((p) => !base.includes(p)), deny: base.filter((p) => !want.includes(p)) };
}

export function roleKeyFrom(name: string): string {
  const k = name.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 28);
  return /^[a-z]/.test(k) ? k : `r_${k}`.slice(0, 30);
}
