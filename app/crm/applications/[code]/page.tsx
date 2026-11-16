import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireStaff } from "@/lib/crm/auth";
import { getApplication } from "@/lib/crm/applications";
import { phoneDisplay } from "@/lib/crm/format";
import { AnswerList, when } from "@/components/crm/Application";
import { Badge, Card, Skeleton, StageBadge, btnGhostCls } from "@/components/crm/ui";

export const metadata = { title: "Driver application" };

export default function ApplicationPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={<div className="px-5 md:px-6"><Skeleton className="h-[70vh]" /></div>}>
      <View params={params} />
    </Suspense>
  );
}

async function View({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[A-Za-z0-9]{6,10}$/.test(code)) notFound();
  const { supabase } = await requireStaff(`/crm/applications/${code}`, "contacts.view");
  const app = await getApplication(supabase, code);
  if (!app) notFound();
  const { data: c } = await supabase.from("contacts").select("stage, company_name, city, state, usdot, cell_phone, phone, email").eq("id", app.contactId).maybeSingle();
  const phone = c?.cell_phone ?? c?.phone;

  return (
    <div className="mx-auto max-w-3xl space-y-3 px-5 pb-10 md:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3 pt-1">
        <div>
          <p className="text-[0.84rem] text-muted">Driver application · submitted {when(app.submittedAt)}</p>
          <h1 className="mt-1 text-[1.6rem] font-medium leading-tight tracking-[-0.025em]">{app.name}</h1>
          <p className="mt-1 text-[0.875rem] text-muted">
            {[c?.company_name, [c?.city, c?.state].filter(Boolean).join(", "), c?.usdot ? `USDOT ${c.usdot}` : null].filter(Boolean).join("  ·  ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {c?.stage && <StageBadge stage={c.stage} />}
          {app.concerns.length > 0 ? <Badge dot tone="bad">{app.concerns.length} to check</Badge> : <Badge dot tone="good">Meets requirements</Badge>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {phone && <a href={`tel:${phone}`} className={btnGhostCls}>Call {phoneDisplay(phone)}</a>}
        {c?.email && <a href={`mailto:${c.email}`} className={btnGhostCls}>Email</a>}
        <Link href={`/crm/contacts/${app.contactId}`} className={btnGhostCls}>Open driver profile</Link>
      </div>

      {app.concerns.length > 0 && (
        <Card className="border-red-200 bg-red-50/60 p-4 text-sm text-red-800">
          Check before calling: {app.concerns.join(", ")}.
        </Card>
      )}

      <Card className="p-4 md:p-6">
        <AnswerList app={app} />
      </Card>
    </div>
  );
}
