import Link from "next/link";
import { Suspense } from "react";
import { clsx } from "clsx";
import { requireStaff } from "@/lib/crm/auth";
import { n } from "@/lib/crm/format";
import { Card, Label, PageHead, Skeleton, Stat } from "@/components/crm/ui";
import { CostsForm } from "@/components/crm/CostsForm";

export const metadata = { title: "Reports" };

type Row = { name: string; total?: number; members?: number; replied: number; applied: number; hired: number; status?: string; stats?: { overall?: Record<string, number> } | null };
type Report = {
  funnel: { contacts: number; contacted: number; replied: number; form_sent: number; applied: number; hired: number };
  by_tier: Row[]; by_source: Row[]; by_campaign: Row[];
  assistant: { runs: number; replied: number; handed_off: number; failed: number; cost: number; avg_latency_ms: number };
  speed: { median_min: number | null; p90_min: number | null; samples: number };
  chase: { chased: number; completed_after: number; by_step: Record<string, number> };
  forms: { name: string; submissions: number }[];
  calls: { calls: number; missed: number; call_requests: number };
  costs: { instantly: number; quo: number; leads: number; other: number };
};

const RANGES: [string, string, number | null][] = [["7d", "7 days", 7], ["30d", "30 days", 30], ["90d", "90 days", 90], ["all", "All time", null]];
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 1000) / 10}%` : "—");
const usd = (v: number) => `$${v.toLocaleString("en-US", { maximumFractionDigits: v < 10 ? 2 : 0 })}`;

export default function ReportsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  return (
    <>
      <PageHead title="Reports" sub="From the first email to a hire: what's working, how fast we answer, and what each hire costs." />
      <Suspense fallback={<div className="p-8"><Skeleton className="h-96" /></div>}>
        <Body searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Body({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range = "30d" } = await searchParams;
  const sel = RANGES.find((r) => r[0] === range) ?? RANGES[1];
  const { supabase, staff } = await requireStaff("/crm/reports");
  const since = await sinceFor(sel[2]);
  const { data, error } = await supabase.rpc("crm_report", { p_since: since });
  if (error || !data) return <p className="p-8 text-sm text-red-300">Couldn&apos;t load the report: {error?.message}</p>;
  const r = data as Report;
  const f = r.funnel;
  const months = sel[2] ? sel[2] / 30 : Math.max(1, monthsSinceStart());
  const fixed = (r.costs.instantly + r.costs.quo + r.costs.leads + r.costs.other) * months;
  const total = fixed + Number(r.assistant.cost || 0);
  const steps = Object.entries(r.chase.by_step).sort((a, b) => Number(a[0]) - Number(b[0]));
  return (
    <div className="space-y-8 p-5 md:p-8">
      <div className="flex flex-wrap gap-1">
        {RANGES.map(([k, l]) => (
          <Link key={k} href={`/crm/reports?range=${k}`} className={clsx("rounded-[4px] px-3 py-1.5 text-sm", k === sel[0] ? "bg-white/10 text-white" : "text-white/50 hover:text-white")}>{l}</Link>
        ))}
      </div>

      {/* funnel */}
      <div>
        <Label>Funnel ({sel[1].toLowerCase()})</Label>
        <div className="mt-3 grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <Stat label="Leads" value={n(f.contacts)} hint={`${n(f.contacted)} emailed`} />
          <Stat label="Replied" value={n(f.replied)} hint={`${pct(f.replied, f.contacted)} of emailed`} />
          <Stat label="Form sent" value={n(f.form_sent)} hint={`${pct(f.form_sent, f.replied)} of replies`} />
          <Stat label="Applied" value={n(f.applied)} hint={`${pct(f.applied, f.replied)} reply → form`} />
          <Stat label="Hired" value={n(f.hired)} hint={`${pct(f.hired, f.applied)} of applied`} />
          <Stat label="Cost per hire" value={f.hired ? usd(total / f.hired) : "—"} hint={f.applied ? `${usd(total / f.applied)} per application` : `${usd(total)} spent`} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="p-5">
          <Label>Speed to reply</Label>
          <p className="mt-3 text-[2rem] font-semibold leading-none tabular-nums">{r.speed.median_min == null ? "—" : `${r.speed.median_min} min`}</p>
          <p className="mt-2 text-xs text-white/45">Median time from a driver&apos;s message to our answer · 90% within {r.speed.p90_min ?? "—"} min · {n(r.speed.samples)} messages</p>
        </Card>
        <Card className="p-5">
          <Label>Assistant</Label>
          <div className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-white/50">Replies written</span><span className="text-right tabular-nums">{n(r.assistant.replied)}</span>
            <span className="text-white/50">Handed to a person</span><span className="text-right tabular-nums">{n(r.assistant.handed_off)}</span>
            <span className="text-white/50">Failed</span><span className="text-right tabular-nums">{n(r.assistant.failed)}</span>
            <span className="text-white/50">AI cost</span><span className="text-right tabular-nums">{usd(Number(r.assistant.cost))}</span>
          </div>
        </Card>
        <Card className="p-5">
          <Label>Calls</Label>
          <div className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-white/50">&quot;Call me now&quot; taps</span><span className="text-right tabular-nums">{n(r.calls.call_requests)}</span>
            <span className="text-white/50">Calls on the Quo line</span><span className="text-right tabular-nums">{n(r.calls.calls)}</span>
            <span className="text-white/50">Missed (texted back)</span><span className="text-right tabular-nums">{n(r.calls.missed)}</span>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <Label>Form follow-ups (14-day chase)</Label>
        <p className="mt-2 text-sm text-white/55">{n(r.chase.chased)} drivers got the link and didn&apos;t fill it right away. <span className="text-white">{n(r.chase.completed_after)} ({pct(r.chase.completed_after, r.chase.chased)})</span> filled it during the follow-ups.</p>
        {steps.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {steps.map(([s, c]) => <span key={s} className="rounded-[4px] border border-white/10 px-3 py-1.5 text-xs">after follow-up #{s}: <b className="tabular-nums">{c}</b></span>)}
          </div>
        )}
      </Card>

      <Table title="By campaign" rows={r.by_campaign} first="members" extra={(x) => { const o = x.stats?.overall ?? {}; const sent = o.emails_sent_count ?? o.sent ?? 0; const rep = o.reply_count ?? o.replies ?? 0; return sent ? `${n(sent)} sent · ${pct(rep, sent)} reply` : x.status ?? ""; }} empty="No campaigns yet." />
      <Table title="By lead tier" rows={r.by_tier} first="total" empty="No leads yet." />
      <Table title="By source" rows={r.by_source} first="total" empty="No leads yet." />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <Label>Forms</Label>
          {r.forms.length ? <ul className="mt-3 space-y-2 text-sm">{r.forms.map((x) => <li key={x.name} className="flex justify-between"><span>{x.name}</span><span className="tabular-nums text-white/70">{n(x.submissions)} submissions</span></li>)}</ul> : <p className="mt-3 text-sm text-white/45">No forms yet.</p>}
        </Card>
        <Card className="p-5">
          <Label>Monthly costs (for cost per hire)</Label>
          <p className="mt-2 text-xs text-white/45">AI cost is counted automatically. Spend in this range: {usd(total)} ({usd(fixed)} fixed + {usd(Number(r.assistant.cost))} AI).</p>
          <div className="mt-4"><CostsForm initial={r.costs} canEdit={staff.role === "admin"} /></div>
        </Card>
      </div>
    </div>
  );
}

function Table({ title, rows, first, extra, empty }: { title: string; rows: Row[]; first: "total" | "members"; extra?: (r: Row) => string; empty: string }) {
  return (
    <Card className="overflow-x-auto">
      <div className="px-5 pt-5"><Label>{title}</Label></div>
      {rows.length ? (
        <table className="mt-3 w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-white/[0.07] text-left text-xs text-white/45">
              <th className="px-5 py-2 font-normal">Name</th>
              <th className="px-3 py-2 text-right font-normal">Leads</th>
              <th className="px-3 py-2 text-right font-normal">Replied</th>
              <th className="px-3 py-2 text-right font-normal">Applied</th>
              <th className="px-3 py-2 text-right font-normal">Reply → form</th>
              <th className="px-3 py-2 text-right font-normal">Hired</th>
              {extra && <th className="px-5 py-2 text-right font-normal">Email</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {rows.map((x) => (
              <tr key={x.name}>
                <td className="px-5 py-2.5">{x.name}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{n(x[first] ?? 0)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{n(x.replied)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{n(x.applied)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-white/70">{pct(x.applied, x.replied)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{n(x.hired)}</td>
                {extra && <td className="px-5 py-2.5 text-right text-xs text-white/50">{extra(x)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="px-5 py-4 text-sm text-white/45">{empty}</p>}
    </Card>
  );
}

async function sinceFor(days: number | null) {
  return days ? new Date(Date.now() - days * 86400_000).toISOString() : "2020-01-01T00:00:00Z";
}
function monthsSinceStart() {
  return Math.ceil((Date.now() - new Date("2026-11-01").getTime()) / (30 * 86400_000));
}
