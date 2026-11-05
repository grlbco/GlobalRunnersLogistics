import { Suspense } from "react";
import { clsx } from "clsx";
import { requireStaff } from "@/lib/crm/auth";
import { adminDb } from "@/lib/crm/admin";
import { getCallHours, inCallHours } from "@/lib/crm/callme";
import { sendingEnvOn } from "@/lib/crm/sending";
import { healthChecks } from "@/lib/crm/health";
import { Card, Label, PageHead, Skeleton } from "@/components/crm/ui";
import { CallHoursForm, PasswordForm, SendingSwitch, TeamPanel } from "@/components/crm/SettingsPanels";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHead title="Settings" sub="Sending, Ken's call hours, your team, your password and every connection." />
      <Suspense fallback={<div className="p-8"><Skeleton className="h-96" /></div>}>
        <Body />
      </Suspense>
    </>
  );
}

async function Body() {
  const { staff } = await requireStaff("/crm/settings");
  const db = adminDb();
  const [{ data: sending }, hours, { data: team }, { data: users }] = await Promise.all([
    db.from("app_settings").select("value, updated_at").eq("key", "sending").maybeSingle(),
    getCallHours(),
    db.from("profiles").select("id, full_name, role, created_at").in("role", ["recruiter", "admin"]).order("created_at"),
    db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  const emailOf = (id: string) => users?.users.find((u) => u.id === id)?.email ?? "";
  const lastSeen = (id: string) => users?.users.find((u) => u.id === id)?.last_sign_in_at ?? null;
  const switchOn = (sending?.value as { enabled?: boolean } | null)?.enabled !== false;
  const isAdmin = staff.role === "admin";
  return (
    <div className="grid gap-6 p-5 md:p-8 xl:grid-cols-2">
      <Card className="p-5 xl:col-span-2">
        <SendingSwitch on={switchOn} envOn={sendingEnvOn()} canEdit={isAdmin} />
      </Card>

      <Card className="p-5">
        <Label>Ken&apos;s call hours</Label>
        <p className="mt-2 text-sm text-white/55">&quot;Call me now&quot; inside these hours tells the driver Ken calls in a few minutes. Outside, it says first thing in the morning. Right now: <span className={clsx(inCallHours(hours) ? "text-emerald-300" : "text-white/70")}>{inCallHours(hours) ? "Ken is available" : "after hours"}</span>.</p>
        <div className="mt-4"><CallHoursForm initial={hours} canEdit={isAdmin} /></div>
      </Card>

      <Card className="p-5">
        <Label>Your password</Label>
        <p className="mt-2 text-sm text-white/55">Signed in as {staff.email} ({staff.role}).</p>
        <div className="mt-4"><PasswordForm /></div>
      </Card>

      <Card className="p-5 xl:col-span-2">
        <Label>Team</Label>
        <div className="mt-4">
          <TeamPanel me={staff.id} canEdit={isAdmin} members={(team ?? []).map((m) => ({ id: m.id, name: m.full_name ?? "", role: m.role as "recruiter" | "admin", email: emailOf(m.id), lastSeen: lastSeen(m.id) }))} />
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
    <ul className="mt-4 divide-y divide-white/[0.06]">
      {checks.map((c) => (
        <li key={c.name} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
          <span className={clsx("h-2.5 w-2.5 shrink-0 rounded-full", c.ok === null ? "bg-white/30" : c.ok ? "bg-emerald-400" : "bg-red-400")} />
          <span className="w-56 font-medium">{c.name}</span>
          <span className="flex-1 text-white/60">{c.detail}</span>
          {c.fix && <span className="text-xs text-amber-200/80">{c.fix}</span>}
        </li>
      ))}
    </ul>
  );
}
