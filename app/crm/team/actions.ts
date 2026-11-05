"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePerm, type Staff } from "@/lib/crm/auth";
import { adminDb } from "@/lib/crm/admin";
import { PERM_KEYS, effectivePerms, type Perm } from "@/lib/crm/permissions";
import { beyondActor, managersAfter, overridesFor, roleKeyFrom, type MemberRow, type RoleRow } from "@/lib/crm/team-rules";

export type TeamResult = { ok: boolean; error?: string; message?: string; password?: string };

const permZ = z.enum(PERM_KEYS as [Perm, ...Perm[]]);
const idZ = z.string().uuid();
const MEMBER_COLS = "id, full_name, crm_role, staff_status, permissions_grant, permissions_deny";

async function load() {
  const db = adminDb();
  const [{ data: roles }, { data: members }] = await Promise.all([
    db.from("crm_roles").select("key, name, permissions").order("created_at"),
    db.from("profiles").select(MEMBER_COLS).not("crm_role", "is", null),
  ]);
  return { db, roles: (roles ?? []) as RoleRow[], members: (members ?? []) as (MemberRow & { full_name: string | null })[] };
}

async function audit(actor: Staff, action: string, target: string | null, data: Record<string, unknown> = {}) {
  await adminDb().from("staff_audit").insert({ actor_id: actor.id, target_id: target, action, data }).then(() => {}, () => {});
}

const tempPassword = () => `${randomBytes(9).toString("base64url")}-${randomBytes(2).toString("hex")}`;
const done = (message: string, extra: Partial<TeamResult> = {}): TeamResult => {
  revalidatePath("/crm/team");
  return { ok: true, message, ...extra };
};

// ─── people ─────────────────────────────────────────────────────────────────

const addZ = z.object({
  name: z.string().trim().min(1, "Enter their name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.string().min(1),
});

/** Creates the login with a temporary password (shown once). They must choose their own on first sign-in. */
export async function addMember(input: unknown): Promise<TeamResult> {
  const { staff } = await requirePerm("team.manage");
  const p = addZ.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message };
  const { db, roles } = await load();
  const role = roles.find((r) => r.key === p.data.role);
  if (!role) return { ok: false, error: "Pick a role." };
  const over = beyondActor(staff.perms, effectivePerms(role.permissions));
  if (over.length) return { ok: false, error: `You can't give the ${role.name} role: it has access you don't have.` };

  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users.find((u) => u.email?.toLowerCase() === p.data.email);
  if (existing) {
    const { data: prof } = await db.from("profiles").select("crm_role").eq("id", existing.id).maybeSingle();
    if (prof?.crm_role) return { ok: false, error: "This person is already on the team." };
    // had a driver-portal login: give access, keep their password
    await db.from("profiles").upsert({ id: existing.id, full_name: p.data.name, crm_role: role.key, staff_status: "active", permissions_grant: [], permissions_deny: [], invited_by: staff.id });
    await audit(staff, "member_added", existing.id, { role: role.key, existing_login: true });
    return done(`${p.data.name} already had a login. They now have ${role.name} access with their current password.`);
  }

  const password = tempPassword();
  const { data: created, error } = await db.auth.admin.createUser({ email: p.data.email, password, email_confirm: true, user_metadata: { full_name: p.data.name } });
  if (error || !created.user) return { ok: false, error: error?.message ?? "Couldn't create the login." };
  // the auth trigger created the profile row; give it access
  await db.from("profiles").upsert({ id: created.user.id, full_name: p.data.name, crm_role: role.key, staff_status: "active", must_change_password: true, invited_by: staff.id });
  await audit(staff, "member_added", created.user.id, { role: role.key });
  return done(`${p.data.name} is added as ${role.name}.`, { password });
}

const updateZ = z.object({ id: idZ, role: z.string().min(1), perms: z.array(permZ).max(PERM_KEYS.length) });

/** Role + the exact checklist of what this person can do (stored as extras/removals on top of the role). */
export async function updateMember(input: unknown): Promise<TeamResult> {
  const { staff } = await requirePerm("team.manage");
  const p = updateZ.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the changes." };
  if (p.data.id === staff.id) return { ok: false, error: "You can't change your own access. Ask another admin." };
  const { db, roles, members } = await load();
  const target = members.find((m) => m.id === p.data.id);
  if (!target) return { ok: false, error: "Not on the team." };
  const role = roles.find((r) => r.key === p.data.role);
  if (!role) return { ok: false, error: "Pick a role." };

  const before = effectivePerms(roles.find((r) => r.key === target.crm_role)?.permissions, target.permissions_grant, target.permissions_deny);
  const { grant, deny } = overridesFor(role.permissions, p.data.perms);
  const after = effectivePerms(role.permissions, grant, deny);
  // you can't add (or keep someone at) access above your own
  const over = beyondActor(staff.perms, after.filter((x) => !before.includes(x)));
  if (over.length) return { ok: false, error: `You can only give access you have yourself (${over.join(", ")}).` };
  if (before.some((x) => !staff.perms.includes(x))) return { ok: false, error: "This person has access you don't have, so only someone above you can change them." };

  const next: MemberRow = { ...target, crm_role: role.key, permissions_grant: grant, permissions_deny: deny };
  if (managersAfter(members, roles, { member: next }) < 1) return { ok: false, error: "Someone has to be able to manage the team. Keep at least one." };
  await db.from("profiles").update({ crm_role: role.key, permissions_grant: grant, permissions_deny: deny }).eq("id", target.id);
  await audit(staff, "member_updated", target.id, { role: role.key, grant, deny, from: { role: target.crm_role, grant: target.permissions_grant, deny: target.permissions_deny } });
  return done("Access saved. It applies on their next click.");
}

const targetZ = z.object({ id: idZ });

async function guardTarget(staff: Staff, id: string) {
  if (id === staff.id) return { error: "You can't do that to your own account. Ask another admin." } as const;
  const ctx = await load();
  const target = ctx.members.find((m) => m.id === id);
  if (!target) return { error: "Not on the team." } as const;
  const theirs = effectivePerms(ctx.roles.find((r) => r.key === target.crm_role)?.permissions, target.permissions_grant, target.permissions_deny);
  if (theirs.some((x) => !staff.perms.includes(x))) return { error: "This person has access you don't have, so only someone above you can change them." } as const;
  return { ...ctx, target } as const;
}

export async function resetMemberPassword(input: unknown): Promise<TeamResult> {
  const { staff } = await requirePerm("team.manage");
  const p = targetZ.safeParse(input);
  if (!p.success) return { ok: false, error: "Who?" };
  const g = await guardTarget(staff, p.data.id);
  if ("error" in g) return { ok: false, error: g.error };
  const password = tempPassword();
  const { error } = await g.db.auth.admin.updateUserById(g.target.id, { password });
  if (error) return { ok: false, error: error.message };
  await g.db.from("profiles").update({ must_change_password: true }).eq("id", g.target.id);
  await audit(staff, "password_reset_by_admin", g.target.id);
  return done("New temporary password set. They choose their own when they sign in.", { password });
}

const statusZ = z.object({ id: idZ, status: z.enum(["active", "suspended"]) });

/** Suspend blocks sign-in at once (and every database read through the CRM). Reactivate undoes it. */
export async function setMemberStatus(input: unknown): Promise<TeamResult> {
  const { staff } = await requirePerm("team.manage");
  const p = statusZ.safeParse(input);
  if (!p.success) return { ok: false, error: "Check the request." };
  const g = await guardTarget(staff, p.data.id);
  if ("error" in g) return { ok: false, error: g.error };
  if (p.data.status === "suspended" && managersAfter(g.members, g.roles, { member: { ...g.target, staff_status: "suspended" } }) < 1) {
    return { ok: false, error: "Someone has to be able to manage the team. Keep at least one." };
  }
  const { error } = await g.db.auth.admin.updateUserById(g.target.id, { ban_duration: p.data.status === "suspended" ? "876000h" : "none" });
  if (error) return { ok: false, error: error.message };
  await g.db.from("profiles").update({ staff_status: p.data.status }).eq("id", g.target.id);
  await audit(staff, p.data.status === "suspended" ? "member_suspended" : "member_reactivated", g.target.id);
  return done(p.data.status === "suspended" ? "Suspended. They can't sign in or see anything." : "Reactivated.");
}

/** Takes CRM access away. Their login stays (they may also be a driver on the portal). */
export async function removeMember(input: unknown): Promise<TeamResult> {
  const { staff } = await requirePerm("team.manage");
  const p = targetZ.safeParse(input);
  if (!p.success) return { ok: false, error: "Who?" };
  const g = await guardTarget(staff, p.data.id);
  if ("error" in g) return { ok: false, error: g.error };
  if (managersAfter(g.members, g.roles, { member: { ...g.target, crm_role: null } }) < 1) return { ok: false, error: "Someone has to be able to manage the team. Keep at least one." };
  await g.db.auth.admin.updateUserById(g.target.id, { ban_duration: "none" });
  await g.db.from("profiles").update({ crm_role: null, staff_status: "active", permissions_grant: [], permissions_deny: [], must_change_password: false }).eq("id", g.target.id);
  await audit(staff, "member_removed", g.target.id, { role: g.target.crm_role });
  return done("Access removed.");
}

// ─── roles ──────────────────────────────────────────────────────────────────

const roleZ = z.object({
  key: z.string().optional(),
  name: z.string().trim().min(1, "Name the role").max(60),
  description: z.string().trim().max(300).optional().default(""),
  perms: z.array(permZ).max(PERM_KEYS.length),
});

/** Create or edit a role. Only Admins edit roles (a role change moves many people at once). The Admin role itself is fixed. */
export async function saveRole(input: unknown): Promise<TeamResult> {
  const { staff } = await requirePerm("team.manage");
  if (staff.roleKey !== "admin") return { ok: false, error: "Only Admins can create or change roles." };
  const p = roleZ.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message };
  if (p.data.key === "admin") return { ok: false, error: "The Admin role always has everything." };
  const { db, roles, members } = await load();
  const perms = effectivePerms(p.data.perms);

  if (p.data.key) {
    const existing = roles.find((r) => r.key === p.data.key);
    if (!existing) return { ok: false, error: "Role not found." };
    const nextRoles = roles.map((r) => (r.key === existing.key ? { ...r, permissions: perms } : r));
    if (managersAfter(members, roles, { roles: nextRoles }) < 1) return { ok: false, error: "That would leave nobody able to manage the team." };
    await db.from("crm_roles").update({ name: p.data.name, description: p.data.description || null, permissions: perms }).eq("key", existing.key);
    await audit(staff, "role_updated", null, { role: existing.key, perms, from: existing.permissions });
    return done(`${p.data.name} saved. Everyone with this role gets the change on their next click.`);
  }

  let key = roleKeyFrom(p.data.name);
  if (key.length < 2) key = `role_${Date.now().toString(36)}`;
  if (roles.some((r) => r.key === key)) return { ok: false, error: "A role with that name already exists." };
  const { error } = await db.from("crm_roles").insert({ key, name: p.data.name, description: p.data.description || null, permissions: perms });
  if (error) return { ok: false, error: error.message };
  await audit(staff, "role_created", null, { role: key, perms });
  return done(`${p.data.name} created.`);
}

export async function deleteRole(input: unknown): Promise<TeamResult> {
  const { staff } = await requirePerm("team.manage");
  if (staff.roleKey !== "admin") return { ok: false, error: "Only Admins can delete roles." };
  const p = z.object({ key: z.string().min(1) }).safeParse(input);
  if (!p.success) return { ok: false, error: "Which role?" };
  const db = adminDb();
  const { data: role } = await db.from("crm_roles").select("key, name, is_system").eq("key", p.data.key).maybeSingle();
  if (!role) return { ok: false, error: "Role not found." };
  if (role.is_system) return { ok: false, error: "Built-in roles can't be deleted." };
  const { count } = await db.from("profiles").select("id", { count: "exact", head: true }).eq("crm_role", role.key);
  if (count) return { ok: false, error: `${count} ${count === 1 ? "person has" : "people have"} this role. Move them to another role first.` };
  await db.from("crm_roles").delete().eq("key", role.key);
  await audit(staff, "role_deleted", null, { role: role.key });
  return done(`${role.name} deleted.`);
}
