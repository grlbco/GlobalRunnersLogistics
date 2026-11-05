import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { effectivePerms, type Perm } from "@/lib/crm/permissions";

export type Staff = {
  id: string;
  email: string;
  name: string;
  /** Legacy two-level role, kept for older checks: "admin" only for the Admin role. */
  role: "recruiter" | "admin";
  roleKey: string;
  roleName: string;
  perms: Perm[];
  can: (perm: Perm) => boolean;
  mustChangePassword: boolean;
};

type Loaded =
  | { state: "signed_out" }
  | { state: "no_access"; email: string; reason: "not_staff" | "suspended" }
  | { state: "ok"; staff: Staff };

/** Reads the signed-in person and their access once per request. */
const load = cache(async (): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; loaded: Loaded }> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return { supabase, loaded: { state: "signed_out" } };
  const email = (claims.email as string) ?? "";
  const { data: p } = await supabase
    .from("profiles")
    .select("full_name, crm_role, staff_status, permissions_grant, permissions_deny, must_change_password, crm_roles(name, permissions)")
    .eq("id", claims.sub)
    .maybeSingle();
  if (!p?.crm_role) return { supabase, loaded: { state: "no_access", email, reason: "not_staff" } };
  if (p.staff_status !== "active") return { supabase, loaded: { state: "no_access", email, reason: "suspended" } };
  const role = (Array.isArray(p.crm_roles) ? p.crm_roles[0] : p.crm_roles) as { name: string; permissions: string[] } | null;
  const perms = effectivePerms(role?.permissions, p.permissions_grant ?? [], p.permissions_deny ?? []);
  const staff: Staff = {
    id: claims.sub,
    email,
    name: p.full_name ?? email.split("@")[0],
    role: p.crm_role === "admin" ? "admin" : "recruiter",
    roleKey: p.crm_role,
    roleName: role?.name ?? p.crm_role,
    perms,
    can: (perm) => perms.includes(perm),
    mustChangePassword: !!p.must_change_password,
  };
  return { supabase, loaded: { state: "ok", staff } };
});

/**
 * Signed-in, active staff member or redirect. Optionally requires one permission.
 * Pages pass their path as `next` so sign-in comes back to them.
 */
export async function requireStaff(next = "/crm", perm?: Perm) {
  const { supabase, loaded } = await load();
  if (loaded.state === "signed_out") redirect(`/crm/login?next=${encodeURIComponent(next)}`);
  if (loaded.state === "no_access") redirect(`/crm/no-access?reason=${loaded.reason}`);
  const { staff } = loaded;
  if (staff.mustChangePassword && next !== "/crm/welcome") redirect(`/crm/welcome?next=${encodeURIComponent(next)}`);
  if (perm && !staff.can(perm)) redirect(`/crm/no-access?reason=permission&need=${encodeURIComponent(perm)}`);
  return { supabase, staff };
}

/** For server actions: same as requireStaff, plus a permission. Redirects to the no-access page when missing. */
export function requirePerm(perm: Perm) {
  return requireStaff("/crm", perm);
}

/** Non-redirecting read, for pages that render differently when signed out (login, no-access). */
export async function currentStaff(): Promise<Loaded> {
  return (await load()).loaded;
}
