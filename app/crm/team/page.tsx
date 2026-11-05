import { Suspense } from "react";
import { requireStaff } from "@/lib/crm/auth";
import { adminDb } from "@/lib/crm/admin";
import { effectivePerms } from "@/lib/crm/permissions";
import { PageHead, Skeleton } from "@/components/crm/ui";
import { TeamManager, type TeamAudit, type TeamMember, type TeamRole } from "@/components/crm/TeamManager";

export const metadata = { title: "Team" };

export default function TeamPage() {
  return (
    <>
      <PageHead title="Team" sub="Who can sign in to the CRM and what each person can do. There is no sign-up: people get in only when they're added here." />
      <Suspense fallback={<div className="px-5 md:px-6"><Skeleton className="h-[60vh]" /></div>}>
        <Body />
      </Suspense>
    </>
  );
}

async function Body() {
  const { staff } = await requireStaff("/crm/team", "team.manage");
  const db = adminDb();
  const [{ data: roles }, { data: profiles }, { data: users }, { data: audit }] = await Promise.all([
    db.from("crm_roles").select("key, name, description, permissions, is_system").order("created_at"),
    db.from("profiles").select("id, full_name, crm_role, staff_status, permissions_grant, permissions_deny, must_change_password, created_at").not("crm_role", "is", null).order("created_at"),
    db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    db.from("staff_audit").select("id, actor_id, target_id, action, data, created_at").order("created_at", { ascending: false }).limit(60),
  ]);
  const user = (id: string | null) => users?.users.find((u) => u.id === id);
  const nameOf = (id: string | null) => profiles?.find((p) => p.id === id)?.full_name ?? user(id)?.email ?? "someone";

  const roleList: TeamRole[] = (roles ?? []).map((r) => ({
    key: r.key, name: r.name, description: r.description, isSystem: r.is_system,
    perms: effectivePerms(r.permissions), all: (r.permissions as string[]).includes("*"),
    count: (profiles ?? []).filter((p) => p.crm_role === r.key).length,
  }));
  const members: TeamMember[] = (profiles ?? []).map((p) => {
    const role = roles?.find((r) => r.key === p.crm_role);
    const u = user(p.id);
    return {
      id: p.id, name: p.full_name ?? u?.email ?? "", email: u?.email ?? "", role: p.crm_role!, status: p.staff_status as "active" | "suspended",
      perms: effectivePerms(role?.permissions, p.permissions_grant, p.permissions_deny),
      grant: p.permissions_grant, deny: p.permissions_deny, pendingPassword: p.must_change_password,
      lastSeen: u?.last_sign_in_at ?? null, addedAt: p.created_at,
    };
  });
  const log: TeamAudit[] = (audit ?? []).map((a) => ({
    id: a.id, at: a.created_at, action: a.action, actor: nameOf(a.actor_id), target: a.target_id ? nameOf(a.target_id) : null,
    role: (a.data as { role?: string } | null)?.role ?? null,
  }));

  return (
    <TeamManager
      me={{ id: staff.id, perms: staff.perms, isAdmin: staff.roleKey === "admin" }}
      members={members}
      roles={roleList}
      log={log}
    />
  );
}
