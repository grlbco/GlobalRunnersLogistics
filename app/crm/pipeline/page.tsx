import Link from "next/link";
import { Suspense } from "react";
import { requireStaff } from "@/lib/crm/auth";
import { BOARD, stageLabel } from "@/lib/crm/stages";
import { ago, fullName, n } from "@/lib/crm/format";
import { PageHead, Skeleton } from "@/components/crm/ui";

export const metadata = { title: "Pipeline" };

export default function PipelinePage() {
  return (
    <>
      <PageHead title="Pipeline" sub="Drivers who replied, from first answer to hired" />
      <Suspense fallback={<div className="flex gap-4 p-5 md:p-8">{BOARD.map((s) => <Skeleton key={s} className="h-96 w-72 shrink-0" />)}</div>}>
        <Board />
      </Suspense>
    </>
  );
}

async function Board() {
  const { supabase } = await requireStaff("/crm/pipeline");
  const cols = await Promise.all(
    BOARD.map(async (stage) => {
      const { data, count } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, company_name, city, state, last_inbound_at, stage_changed_at", { count: "exact" })
        .eq("stage", stage)
        .order("stage_changed_at", { ascending: false })
        .limit(50);
      return { stage, items: data ?? [], count: count ?? 0 };
    }),
  );
  return (
    <div className="flex gap-4 overflow-x-auto p-5 md:p-8">
      {cols.map((col) => (
        <section key={col.stage} className="flex w-72 shrink-0 flex-col rounded-[6px] border border-white/[0.07] bg-white/[0.015]">
          <header className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <h2 className="text-sm font-medium">{stageLabel(col.stage)}</h2>
            <span className="font-mono text-xs text-white/45">{n(col.count)}</span>
          </header>
          <ul className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto p-2">
            {col.items.map((c) => (
              <li key={c.id}>
                <Link href={`/crm/contacts/${c.id}`} className="block rounded-[4px] border border-white/[0.07] bg-ink p-3 transition-colors hover:border-white/25">
                  <p className="truncate text-sm font-medium">{fullName(c)}</p>
                  <p className="truncate text-xs text-white/45">{c.company_name}</p>
                  <div className="mt-2 flex justify-between text-[0.7rem] text-white/40">
                    <span>{[c.city, c.state].filter(Boolean).join(", ")}</span>
                    <span>{ago(c.last_inbound_at ?? c.stage_changed_at)}</span>
                  </div>
                </Link>
              </li>
            ))}
            {col.items.length === 0 && <li className="px-2 py-6 text-center text-xs text-white/30">Empty</li>}
          </ul>
        </section>
      ))}
    </div>
  );
}
