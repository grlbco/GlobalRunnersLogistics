import Link from "next/link";
import { Suspense } from "react";
import { PERMISSIONS } from "@/lib/crm/permissions";
import { currentStaff } from "@/lib/crm/auth";
import { crmSignOut } from "@/app/crm/auth-actions";
import { AuthShell } from "@/components/crm/AuthPanels";

export const metadata = { title: "No access" };

type SP = Promise<{ reason?: string; need?: string }>;

export default function NoAccess({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<div className="h-dvh" />}>
      <Body searchParams={searchParams} />
    </Suspense>
  );
}

async function Body({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const loaded = await currentStaff();
  const need = PERMISSIONS.find((p) => p.key === sp.need);
  const text =
    sp.reason === "suspended" ? "Your CRM access is suspended. Ask an admin if this is a mistake."
    : sp.reason === "permission" ? `Your role doesn't include this${need ? ` (${need.label.toLowerCase()})` : ""}. Ask an admin to give you access.`
    : "This account isn't a staff account. Ask an admin to add you on the Team page.";
  return (
    <AuthShell title="No access" sub={text}>
      <div className="flex flex-wrap gap-3">
        {loaded.state === "ok" && <Link href="/crm/account" className="inline-flex h-10 items-center rounded-[7px] border border-line px-4 text-sm text-fg-2 hover:border-line-strong hover:text-fg">My account</Link>}
        {loaded.state !== "signed_out" && (
          <form action={crmSignOut}>
            <button className="inline-flex h-10 items-center rounded-[7px] border border-line px-4 text-sm text-fg-2 hover:border-line-strong hover:text-fg">Sign in as someone else</button>
          </form>
        )}
        <Link href="/" className="inline-flex h-10 items-center px-2 text-sm text-muted underline-offset-4 hover:text-fg hover:underline">Back to the website</Link>
      </div>
    </AuthShell>
  );
}
