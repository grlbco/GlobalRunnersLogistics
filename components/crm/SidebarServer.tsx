import { currentStaff } from "@/lib/crm/auth";
import { SECTIONS } from "@/lib/crm/permissions";
import { Sidebar } from "@/components/crm/Sidebar";

/** Only the sections this person may open. Nothing at all when signed out or without access (login, no-access pages). */
export async function SidebarServer() {
  const loaded = await currentStaff();
  if (loaded.state !== "ok" || loaded.staff.mustChangePassword) return null;
  const { staff } = loaded;
  return <Sidebar allowed={SECTIONS.filter((s) => staff.can(s.perm)).map((s) => s.href)} me={{ name: staff.name, role: staff.roleName }} />;
}
