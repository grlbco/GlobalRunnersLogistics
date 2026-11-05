import { currentStaff } from "@/lib/crm/auth";
import { adminDb } from "@/lib/crm/admin";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "./TopBar";

/** Nothing when signed out or without access (login, no-access pages). A failed count never blocks the page. */
export async function TopBarServer() {
  const loaded = await currentStaff();
  if (loaded.state !== "ok" || loaded.staff.mustChangePassword) return null;
  const { staff } = loaded;

  const [team, unread] = await Promise.all([
    (async () => {
      try {
        const { data, count } = await adminDb().from("profiles").select("full_name", { count: "exact" }).not("crm_role", "is", null).eq("staff_status", "active").not("full_name", "is", null).neq("id", staff.id).order("created_at").limit(2);
        return { names: (data ?? []).map((p) => p.full_name as string), total: count ?? 0 };
      } catch {
        return { names: [], total: 0 };
      }
    })(),
    staff.can("inbox.view")
      ? (await createClient()).from("conversations").select("*", { count: "exact", head: true }).eq("unread", true).then((r) => r.count ?? 0, () => 0)
      : Promise.resolve(null),
  ]);

  return <TopBar me={{ name: staff.name }} team={{ ...team, href: staff.can("team.manage") ? "/crm/team" : null }} unread={unread} canSearch={staff.can("contacts.view")} />;
}
