import Link from "next/link";
import { Suspense } from "react";
import { clsx } from "clsx";
import { requireStaff } from "@/lib/crm/auth";
import { ago, n } from "@/lib/crm/format";
import { TEMPLATES } from "@/lib/formbuilder/schema";
import { Card, Label, PageHead, Skeleton, btnCls, btnGhostCls } from "@/components/crm/ui";
import { createForm } from "./actions";

export const metadata = { title: "Forms" };

export default function FormsPage() {
  return (
    <>
      <PageHead
        title="Forms"
        sub="Forms that drop answers straight onto driver profiles, move the card in the pipeline and start the assistant."
        right={
          <form action={createForm}>
            <input type="hidden" name="template" value="blank" />
            <button className={btnCls}>New form</button>
          </form>
        }
      />
      <Suspense fallback={<div className="p-8"><Skeleton className="h-96" /></div>}>
        <List />
      </Suspense>
    </>
  );
}

const STATUS: Record<string, string> = { draft: "bg-white/[0.06] text-white/55", published: "bg-emerald-400/15 text-emerald-300", closed: "bg-white/[0.04] text-white/35" };

async function List() {
  const { supabase } = await requireStaff("/crm/forms");
  const [{ data: forms }, { data: subs }, { data: links }] = await Promise.all([
    supabase.from("crm_forms").select("id, name, slug, status, updated_at").order("created_at", { ascending: false }),
    supabase.from("crm_form_submissions").select("form_id, created_at").order("created_at", { ascending: false }).limit(5000),
    supabase.from("form_links").select("sent_at, opened_at, completed_at").limit(20000),
  ]);
  const count = (id: string) => (subs ?? []).filter((s) => s.form_id === id).length;
  const lastAt = (id: string) => (subs ?? []).find((s) => s.form_id === id)?.created_at;
  const sent = (links ?? []).filter((l) => l.sent_at).length;
  const opened = (links ?? []).filter((l) => l.opened_at).length;
  const done = (links ?? []).filter((l) => l.completed_at).length;
  return (
    <div className="space-y-8 p-5 md:p-8">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-medium">Driver application <span className="ml-2 rounded-full bg-white/[0.06] px-2 py-0.5 text-[0.7rem] text-white/55">built in</span></p>
            <p className="mt-1 text-sm text-white/50">The 2-minute application at /apply/driver. The assistant sends each driver a personal link and chases it until it&apos;s done.</p>
          </div>
          <div className="flex gap-6 text-sm tabular-nums">
            <span><span className="text-white/45">Sent</span> {n(sent)}</span>
            <span><span className="text-white/45">Opened</span> {n(opened)}</span>
            <span><span className="text-white/45">Completed</span> {n(done)}</span>
          </div>
        </div>
      </Card>

      <div>
        <Label>Your forms</Label>
        {forms?.length ? (
          <Card className="mt-3 divide-y divide-white/[0.06]">
            {forms.map((f) => (
              <Link key={f.id} href={`/crm/forms/${f.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-4 hover:bg-white/[0.02]">
                <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
                <span className={clsx("rounded-full px-2 py-0.5 text-[0.72rem]", STATUS[f.status])}>{f.status}</span>
                <span className="font-mono text-xs text-white/40">/f/{f.slug}</span>
                <span className="w-28 text-right text-sm tabular-nums text-white/70">{n(count(f.id))} answers</span>
                <span className="w-24 text-right text-xs text-white/40">{lastAt(f.id) ? ago(lastAt(f.id)) : "none yet"}</span>
              </Link>
            ))}
          </Card>
        ) : (
          <p className="mt-3 text-sm text-white/45">No forms yet. Start from a template below.</p>
        )}
      </div>

      <div>
        <Label>Start from a template</Label>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          {Object.entries(TEMPLATES).map(([key, t]) => (
            <Card key={key} className="flex flex-col p-5">
              <p className="font-medium">{t.name}</p>
              <p className="mt-1 flex-1 text-sm text-white/50">{t.schema.settings.description}</p>
              <p className="mt-3 text-xs text-white/40">{t.schema.pages.reduce((s, p) => s + p.fields.length, 0)} questions{t.on_submit.assistant === "reply" ? " · assistant replies" : ""}{t.on_submit.telegram ? " · Telegram alert" : ""}</p>
              <form action={createForm} className="mt-4">
                <input type="hidden" name="template" value={key} />
                <button className={btnGhostCls}>Use template</button>
              </form>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
