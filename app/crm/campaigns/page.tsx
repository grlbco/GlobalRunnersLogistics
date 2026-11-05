import Link from "next/link";
import { Suspense } from "react";
import { clsx } from "clsx";
import { requireStaff } from "@/lib/crm/auth";
import { ago, n } from "@/lib/crm/format";
import { btnCls, Empty, PageHead, Skeleton } from "@/components/crm/ui";
import { createDraft } from "./actions";

export const metadata = { title: "Campaigns" };

const tone: Record<string, string> = { draft: "bg-hover text-muted", paused: "bg-[#fdf3e7] text-[#8a4f0e]", active: "bg-emerald-50 text-emerald-700", completed: "bg-hover text-muted", error: "bg-red-50 text-red-600" };
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
  if (!data?.length) return <div className="px-5 md:px-6"><Empty title="No campaigns yet">Start one: it comes with a ready-to-edit sequence (3 emails, 3 versions of the first one).</Empty></div>;
  return (
    <div className="px-5 md:px-6"><div className="overflow-x-auto rounded-[14px] border border-line bg-surface shadow-card">
      <table className="w-full min-w-[820px] text-left text-[0.84rem]">
        <thead className="text-[0.75rem] text-muted"><tr><th className="py-2.5 pl-5 font-medium">Campaign</th><th className="font-medium">Status</th><th className="font-medium">Leads</th><th className="font-medium">Sent</th><th className="font-medium">Opened</th><th className="font-medium">Replied</th><th className="font-medium">Bounced</th><th className="pr-5 text-right font-medium">Updated</th></tr></thead>
        <tbody className="divide-y divide-line">
          {data.map((c) => {
            const o = ((c.stats as { overall?: Record<string, unknown> })?.overall ?? {}) as Record<string, unknown>;
            const sent = num(o, "emails_sent_count", "sent");
            return (
              <tr key={c.id} className="transition-colors hover:bg-subtle">
                <td className="py-3 pl-5"><Link href={`/crm/campaigns/${c.id}`} className="font-medium hover:underline">{c.name}</Link></td>
                <td><span className={clsx("inline-flex items-center rounded-full px-2 py-[3px] text-[0.72rem] font-medium capitalize leading-none", tone[c.status])}>{c.status}</span></td>
                <td className="tabular-nums">{n(c.leads_added)}</td>
                <td className="tabular-nums">{n(sent)}</td>
                <td className="tabular-nums">{pct(num(o, "open_count_unique", "open_count"), num(o, "contacted_count") || sent)}</td>
                <td className="tabular-nums">{pct(num(o, "reply_count_unique", "reply_count"), num(o, "contacted_count") || sent)}</td>
                <td className="tabular-nums">{pct(num(o, "bounced_count"), sent)}</td>
                <td className="pr-5 text-right text-faint">{ago(c.stats_synced_at ?? c.created_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div></div>
  );
}
