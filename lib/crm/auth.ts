import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Staff = { id: string; email: string; name: string; role: "recruiter" | "admin" };

/** Signed-in staff member or redirect. Returns the RLS-scoped client too. */
export async function requireStaff(next = "/crm") {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect(`/login?next=${encodeURIComponent(next)}`);
  const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", claims.sub).maybeSingle();
  if (!profile || (profile.role !== "recruiter" && profile.role !== "admin")) redirect("/crm/no-access");
  const staff: Staff = {
    id: claims.sub,
    email: (claims.email as string) ?? "",
    name: profile.full_name ?? ((claims.email as string) ?? "").split("@")[0],
    role: profile.role,
  };
  return { supabase, staff };
}
