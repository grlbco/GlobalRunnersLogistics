import Link from "next/link";
import { Suspense } from "react";
import { clsx } from "clsx";
import { requireStaff } from "@/lib/crm/auth";
import { adminDb } from "@/lib/crm/admin";
import { getCallHours, inCallHours } from "@/lib/crm/callme";
import { sendingEnvOn } from "@/lib/crm/sending";
import { healthChecks } from "@/lib/crm/health";
import { Card, Label, PageHead, Skeleton, btnGhostCls } from "@/components/crm/ui";
import { CallHoursForm, SendingSwitch } from "@/components/crm/SettingsPanels";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHead title="Settings" sub="Sending, Ken's call hours and every connection." />
      <Suspense fallback={<div className="p-8"><Skeleton className="h-96" /></div>}>
        <Body />
      </Suspense>
    </>
  );
}

async function Body() {
  const { staff } = await requireStaff("/crm/settings", "settings.view");
  const db = adminDb();
  const [{ data: sending }, hours] = await Promise.all([
    db.from("app_settings").select("value, updated_at").eq("key", "sending").maybeSingle(),
    getCallHours(),
  ]);
  const switchOn = (sending?.value as { enabled?: boolean } | null)?.enabled !== false;
  const isAdmin = staff.can("settings.manage");
  return (
    <div className="grid gap-6 p-5 md:p-8 xl:grid-cols-2">
      <Card className="p-5 xl:col-span-2">
        <SendingSwitch on={switchOn} envOn={sendingEnvOn()} canEdit={isAdmin} />
      </Card>

      <Card className="p-5">
        <Label>Ken&apos;s call hours</Label>
        <p className="mt-2 text-sm text-muted">&quot;Call me now&quot; inside these hours tells the driver Ken calls in a few minutes. Outside, it says first thing in the morning. Right now: <span className={clsx(inCallHours(hours) ? "text-emerald-700" : "text-muted")}>{inCallHours(hours) ? "Ken is available" : "after hours"}</span>.</p>
        <div className="mt-4"><CallHoursForm initial={hours} canEdit={isAdmin} /></div>
      </Card>

      <Card className="p-5">
        <Label>Team and your account</Label>
        <p className="mt-2 text-sm text-muted">Signed in as {staff.email} ({staff.roleName}).</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/crm/account" className={btnGhostCls}>My account and password</Link>
          {staff.can("team.manage") && <Link href="/crm/team" className={btnGhostCls}>Team and permissions</Link>}
        </div>
      </Card>

      <Card className="p-5 xl:col-span-2">
        <Label>Connections</Label>
        <Suspense fallback={<Skeleton className="mt-4 h-48" />}>
          <Connections />
        </Suspense>
      </Card>
    </div>
  );
}

async function Connections() {
  const checks = await healthChecks();
  return (
    <ul className="mt-4 divide-y divide-line">
      {checks.map((c) => (
        <li key={c.name} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
          <span className={clsx("h-2.5 w-2.5 shrink-0 rounded-full", c.ok === null ? "bg-line-strong" : c.ok ? "bg-emerald-400" : "bg-red-400")} />
          <span className="w-56 font-medium">{c.name}</span>
          <span className="flex-1 text-muted">{c.detail}</span>
          {c.fix && <span className="text-xs text-amber-700">{c.fix}</span>}
        </li>
      ))}
    </ul>
  );
}
