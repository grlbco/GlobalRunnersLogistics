import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireStaff } from "@/lib/crm/auth";
import { ago, fullName } from "@/lib/crm/format";
import { Card, Label, Skeleton } from "@/components/crm/ui";
import { WorkflowEditor } from "@/components/crm/WorkflowEditor";
import { deleteWorkflow } from "../actions";

export default function WorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="p-8"><Skeleton className="h-[70vh]" /></div>}>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase, staff } = await requireStaff(`/crm/automations/${id}`, "automations.view");
  const [{ data: wf }, { data: runs }] = await Promise.all([
    supabase.from("workflows").select("*").eq("id", id).maybeSingle(),
    supabase.from("workflow_runs").select("id, status, step_index, wake_at, created_at, contact:contacts(id, first_name, last_name, company_name)").eq("workflow_id", id).order("created_at", { ascending: false }).limit(25),
  ]);
  if (!wf) notFound();
  return (
    <div className="grid gap-6 p-5 md:p-8 xl:grid-cols-[1fr_22rem]">
      <div>
        <Link href="/crm/automations" className="text-xs text-white/45 hover:text-white">← Automations</Link>
        <div className="mt-4">
          <WorkflowEditor initial={{ id: wf.id, name: wf.name, description: wf.description, trigger_type: wf.trigger_type, trigger_filter: wf.trigger_filter, steps: wf.steps, active: wf.active }} canEdit={staff.can("automations.manage")} />
        </div>
        {!wf.builtin && staff.can("automations.manage") && (
          <form action={deleteWorkflow} className="mt-6">
            <input type="hidden" name="id" value={wf.id} />
            <button className="text-xs text-red-300/80 hover:text-red-300">Delete this automation</button>
          </form>
        )}
      </div>
      <Card className="h-fit p-5">
        <Label>Recent runs</Label>
        {runs?.length ? (
          <ul className="mt-3 divide-y divide-white/[0.06] text-sm">
            {runs.map((r) => {
              const c = r.contact as unknown as { id: string; first_name: string | null; last_name: string | null; company_name: string | null } | null;
              return (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  {c ? <Link href={`/crm/contacts/${c.id}`} className="truncate hover:underline">{fullName(c)}</Link> : <span>—</span>}
                  <span className="shrink-0 text-xs text-white/45">{r.status === "waiting" ? `step ${r.step_index + 1}, wakes ${ago(r.wake_at).replace("now", "soon")}` : r.status} · {ago(r.created_at)}</span>
                </li>
              );
            })}
          </ul>
        ) : <p className="mt-3 text-sm text-white/45">No runs yet.</p>}
      </Card>
    </div>
  );
}
