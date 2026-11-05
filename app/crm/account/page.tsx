import Link from "next/link";
import { Suspense } from "react";
import { requireStaff } from "@/lib/crm/auth";
import { PERMISSIONS, SECTIONS } from "@/lib/crm/permissions";
import { crmSignOut } from "@/app/crm/auth-actions";
import { NewPasswordForm } from "@/components/crm/AuthPanels";
import { Card, Label, PageHead, Skeleton, btnGhostCls } from "@/components/crm/ui";

export const metadata = { title: "My account" };

export default function AccountPage() {
  return (
    <>
      <PageHead title="My account" sub="Your sign-in, your password and what you have access to." />
      <Suspense fallback={<div className="p-8"><Skeleton className="h-96" /></div>}>
        <Body />
      </Suspense>
    </>
  );
}

async function Body() {
  const { staff } = await requireStaff("/crm/account");
  const sections = SECTIONS.filter((s) => staff.can(s.perm));
  const groups = [...new Set(PERMISSIONS.map((p) => p.group))];
  return (
    <div className="grid gap-3 px-5 md:px-6 xl:grid-cols-2">
      <Card className="p-5">
        <Label>Signed in</Label>
        <p className="mt-3 text-lg font-medium">{staff.name}</p>
        <p className="text-sm text-muted">{staff.email}</p>
        <p className="mt-3 inline-flex rounded-full border border-line px-2.5 py-0.5 text-xs text-fg-2">{staff.roleName}</p>
        <form action={crmSignOut} className="mt-5">
          <button className={btnGhostCls}>Sign out</button>
        </form>
      </Card>

      <Card className="p-5">
        <Label>Change password</Label>
        <div className="mt-4 max-w-sm"><NewPasswordForm next="stay" /></div>
      </Card>

      {/* On phones the bottom bar only fits four sections: the rest are here. */}
      <Card className="p-5 md:hidden">
        <Label>Sections</Label>
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {sections.map((s) => (
            <li key={s.href}><Link href={s.href} className="block rounded-[10px] border border-line px-3 py-2.5 text-sm text-fg-2">{s.label}</Link></li>
          ))}
        </ul>
      </Card>

      <Card className="p-5 xl:col-span-2">
        <Label>What you can do</Label>
        <div className="mt-4 grid gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => (
            <div key={g}>
              <p className="text-sm font-medium text-fg-2">{g}</p>
              <ul className="mt-2 space-y-1.5">
                {PERMISSIONS.filter((p) => p.group === g).map((p) => (
                  <li key={p.key} className="flex gap-2 text-sm">
                    <span className={staff.can(p.key) ? "text-emerald-700" : "text-ghost"}>{staff.can(p.key) ? "✓" : "–"}</span>
                    <span className={staff.can(p.key) ? "text-fg-2" : "text-ghost"}>{p.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-5 text-xs text-faint">Need more? Ask someone who manages the team.</p>
      </Card>
    </div>
  );
}
