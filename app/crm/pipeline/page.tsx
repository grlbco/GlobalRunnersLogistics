import { Suspense } from "react";
import { requireStaff } from "@/lib/crm/auth";
import Link from "next/link";
import { BOARD, OFF_BOARD, stageLabel } from "@/lib/crm/stages";
import { ago, fullName, phoneDisplay } from "@/lib/crm/format";
import { PageHead, Skeleton } from "@/components/crm/ui";
import { Board } from "@/components/crm/Board";

export const metadata = { title: "Pipeline" };

export default function PipelinePage() {
  return (
    <>
      <PageHead title="Pipeline" sub="The assistant moves cards from what drivers say. Drag one to take over that driver." />
      <Suspense fallback={<div className="flex gap-3 p-5 md:px-6 md:py-6">{BOARD.map((s) => <Skeleton key={s} className="h-96 w-[17.5rem] shrink-0" />)}</div>}>
        <Data />
      </Suspense>
    </>
  );
}

async function Data() {
  const { supabase } = await requireStaff("/crm/pipeline", "pipeline.view");
  const columns = await Promise.all(
    BOARD.map(async (stage) => {
      const { data, count } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, company_name, city, state, email, phone, tier, last_inbound_at, stage_changed_at, stage_locked_at", { count: "exact" })
        .eq("stage", stage)
        .order("stage_changed_at", { ascending: false })
        .limit(50);
      return {
        stage,
        label: stageLabel(stage),
        count: count ?? 0,
        items: (data ?? []).map((c) => ({
          id: c.id,
          name: fullName(c),
          company: c.company_name,
          place: [c.city, c.state].filter(Boolean).join(", "),
          when: ago(c.last_inbound_at ?? c.stage_changed_at),
          email: c.email,
          phone: c.phone ? phoneDisplay(c.phone) : null,
          tier: c.tier,
          locked: !!c.stage_locked_at,
        })),
      };
    }),
  );
  const off = await Promise.all(OFF_BOARD.map(async (s) => [s, (await supabase.from("contacts").select("*", { count: "exact", head: true }).eq("stage", s)).count ?? 0] as const));
  return (
    <>
      <Board columns={columns} />
      <nav aria-label="Paused and closed" className="flex flex-wrap items-center gap-2 px-5 pt-3 text-[0.8rem] md:px-6">
        <span className="text-muted">Off the board:</span>
        {off.map(([s, n]) => <Link key={s} href={`/crm/contacts?stage=${s}`} className="rounded-[9px] border border-line bg-surface px-2.5 py-1 text-fg-2 transition-colors hover:bg-hover">{stageLabel(s)} <span className="tabular-nums text-faint">{n.toLocaleString("en-US")}</span></Link>)}
      </nav>
    </>
  );
}
