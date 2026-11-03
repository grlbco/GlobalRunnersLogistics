import Link from "next/link";
import { Suspense } from "react";
import { clsx } from "clsx";
import { requireStaff } from "@/lib/crm/auth";
import { TRIGGERS, type TriggerType } from "@/lib/automations/types";
import { stageLabel } from "@/lib/crm/stages";
import { Card, PageHead, Skeleton, btnCls } from "@/components/crm/ui";
import { createWorkflow, toggleWorkflow } from "./actions";

export const metadata = { title: "Automations" };

export default function AutomationsPage() {
  return (
    <>
      <PageHead
        title="Automations"
        sub="When something happens to a driver, do these steps. Texts and emails still go through every compliance check."
        right={<form action={createWorkflow}><button className={btnCls}>New automation</button></form>}
      />
      <Suspense fallback={<div className="p-8"><Skeleton className="h-96" /></div>}>
        <List />
      </Suspense>
    </>
  );
}

async function List() {
  const { supabase } = await requireStaff("/crm/automations");
  const [{ data: flows }, { data: runs }] = await Promise.all([
    supabase.from("workflows").select("id, name, description, trigger_type, trigger_filter, steps, active, builtin").order("builtin", { ascending: false }).order("created_at"),
    supabase.from("workflow_runs").select("workflow_id, status"),
  ]);
  const stat = (id: string, s: string) => (runs ?? []).filter((r) => r.workflow_id === id && r.status === s).length;
  return (
    <div className="grid gap-4 p-5 md:p-8 lg:grid-cols-2">
      {(flows ?? []).map((f) => {
        const filter = f.trigger_filter as Record<string, string>;
        return (
          <Card key={f.id} className="flex flex-col p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Link href={`/crm/automations/${f.id}`} className="font-medium hover:underline">{f.name}</Link>
                <p className="mt-1 text-sm text-white/50">{f.description}</p>
              </div>
              <form action={toggleWorkflow}>
                <input type="hidden" name="id" value={f.id} />
                <button aria-label={f.active ? "Turn off" : "Turn on"} className={clsx("relative h-6 w-11 shrink-0 rounded-full transition-colors", f.active ? "bg-signal" : "bg-white/15")}>
                  <span className={clsx("absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all", f.active ? "left-[22px]" : "left-0.5")} />
                </button>
              </form>
            </div>
            <p className="mt-4 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-white/40">
              When: {TRIGGERS[f.trigger_type as TriggerType]?.label ?? f.trigger_type}
              {filter.to ? ` → ${stageLabel(filter.to)}` : ""}{filter.source ? ` (${filter.source.replace(/_/g, " ")})` : ""}{filter.tag ? ` #${filter.tag}` : ""}
              {" · "}{(f.steps as unknown[]).length} steps
            </p>
            <div className="mt-3 flex gap-4 text-xs text-white/50">
              <span>{stat(f.id, "waiting")} waiting</span>
              <span>{stat(f.id, "done")} done</span>
              <span>{stat(f.id, "stopped")} stopped</span>
              {stat(f.id, "failed") > 0 && <span className="text-red-300">{stat(f.id, "failed")} failed</span>}
            </div>
          </Card>
        );
      })}
      <Card className="p-5 lg:col-span-2">
        <p className="font-medium">Daily digest</p>
        <p className="mt-1 text-sm text-white/50">Every morning at 8:00 Pacific, an email to the alert address with replies, completed forms, new applications and open tasks.</p>
      </Card>
    </div>
  );
}
