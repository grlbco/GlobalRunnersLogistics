import { Suspense } from "react";
import { requireStaff } from "@/lib/crm/auth";
import { BOARD, stageLabel } from "@/lib/crm/stages";
import { ago, fullName, phoneDisplay } from "@/lib/crm/format";
import { PageHead, Skeleton } from "@/components/crm/ui";
import { Board } from "@/components/crm/Board";

export const metadata = { title: "Pipeline" };

export default function PipelinePage() {
  return (
    <>
      <PageHead title="Pipeline" sub="Drag a card to move a driver to the next stage" />
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
        .select("id, first_name, last_name, company_name, city, state, email, phone, tier, last_inbound_at, stage_changed_at", { count: "exact" })
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
        })),
      };
    }),
  );
  return <Board columns={columns} />;
}
