import Link from "next/link";
import { Suspense } from "react";
import { clsx } from "clsx";
import { requireStaff } from "@/lib/crm/auth";
import { ago, n } from "@/lib/crm/format";
import { PageHead, Skeleton, btnCls } from "@/components/crm/ui";
import { createDraft } from "./actions";

export const metadata = { title: "Campaigns" };

const tone: Record<string, string> = { draft: "bg-white/[0.06] text-white/60", paused: "bg-dusk/15 text-dusk", active: "bg-emerald-400/15 text-emerald-300", completed: "bg-white/[0.06] text-white/60", error: "bg-red-500/15 text-red-300" };
const num = (o: Record<string, unknown>, ...keys: string[]) => Number(keys.map((k) => o?.[k]).find((v) => v !== undefined) ?? 0);
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");

export default function CampaignsPage() {
  return (
    <>
      <PageHead title="Campaigns" sub="Cold email sequences sent through Instantly, with A/B/C testing. Replies land in the Inbox." right={<form action={createDraft}><button className={btnCls}>New campaign</button></form>} />
      <Suspense fallback={<div className="p-8"><Skeleton className="h-64" /></div>}>
        <List />
      </Suspense>
    </>
  );
}

async function List() {
  const { supabase } = await requireStaff("/crm/campaigns", "campaigns.view");
  const { data } = await supabase.from("campaigns").select("id, name, status, leads_added, stats, stats_synced_at, created_at").order("created_at", { ascending: false });
  if (!data?.length) return <div className="p-5 md:p-8"><div className="rounded-[6px] border border-dashed border-white/10 p-16 text-center text-sm text-white/50">No campaigns yet. Start one: it comes with a ready-to-edit sequence (3 emails, 3 versions of the first one).</div></div>;
  return (
    <div className="overflow-x-auto p-5 md:p-8">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-white/45"><tr><th className="py-3 font-normal">Campaign</th><th className="font-normal">Status</th><th className="font-normal">Leads</th><th className="font-normal">Sent</th><th className="font-normal">Opened</th><th className="font-normal">Replied</th><th className="font-normal">Bounced</th><th className="text-right font-normal">Updated</th></tr></thead>
        <tbody className="divide-y divide-white/[0.06]">
          {data.map((c) => {
            const o = ((c.stats as { overall?: Record<string, unknown> })?.overall ?? {}) as Record<string, unknown>;
            const sent = num(o, "emails_sent_count", "sent");
            return (
              <tr key={c.id} className="hover:bg-white/[0.02]">
                <td className="py-3"><Link href={`/crm/campaigns/${c.id}`} className="font-medium hover:underline">{c.name}</Link></td>
                <td><span className={clsx("rounded-full px-2 py-0.5 text-xs capitalize", tone[c.status])}>{c.status}</span></td>
                <td className="tabular-nums">{n(c.leads_added)}</td>
                <td className="tabular-nums">{n(sent)}</td>
                <td className="tabular-nums">{pct(num(o, "open_count_unique", "open_count"), num(o, "contacted_count") || sent)}</td>
                <td className="tabular-nums">{pct(num(o, "reply_count_unique", "reply_count"), num(o, "contacted_count") || sent)}</td>
                <td className="tabular-nums">{pct(num(o, "bounced_count"), sent)}</td>
                <td className="text-right text-white/45">{ago(c.stats_synced_at ?? c.created_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
