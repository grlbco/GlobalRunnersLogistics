import { Suspense } from "react";
import { requireStaff } from "@/lib/crm/auth";
import { n } from "@/lib/crm/format";
import { Card, Empty, LinkTabs, PageHead, Panel, Skeleton, Stat } from "@/components/crm/ui";
import { BarList, Funnel, Meter } from "@/components/crm/charts";
import { CountUp, FadeIn, Stagger, StaggerItem } from "@/components/crm/motion";
import { ActivityChart, Kpi, type Daily } from "@/components/crm/DashboardBits";
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
    <Suspense fallback={<div className="p-8"><Skeleton className="h-8 w-48" /><Skeleton className="mt-6 h-96" /></div>}>
      <Body searchParams={searchParams} />
    </Suspense>
  );
}

async function Body({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range = "30d" } = await searchParams;
  const sel = RANGES.find((r) => r[0] === range) ?? RANGES[1];
  const { supabase, staff } = await requireStaff("/crm/reports", "reports.view");
  const since = await sinceFor(sel[2]);
  const [{ data, error }, daily] = await Promise.all([
    supabase.rpc("crm_report", { p_since: since }),
    supabase.rpc("crm_daily", { p_days: sel[2] ?? 90 }),
  ]);
  const head = (
    <PageHead
      title="Reports"
      sub="From the first email to a hire: what's working, how fast we answer, and what each hire costs."
      right={<LinkTabs active={sel[0]} items={RANGES.map(([k, l]) => ({ key: k, label: l, href: `/crm/reports?range=${k}` }))} />}
    />
  );
  if (error || !data) return <>{head}<p className="p-8 text-sm text-red-600">Couldn&apos;t load the report: {error?.message}</p></>;
  const r = data as Report;
  const f = r.funnel;
  const months = sel[2] ? sel[2] / 30 : Math.max(1, monthsSinceStart());
  const fixed = (r.costs.instantly + r.costs.quo + r.costs.leads + r.costs.other) * months;
  const total = fixed + Number(r.assistant.cost || 0);
  const steps = Object.entries(r.chase.by_step).sort((a, b) => Number(a[0]) - Number(b[0]));
  const days = ((daily.data ?? []) as Daily[]).map((d) => ({ ...d, replies: Number(d.replies), answered: Number(d.answered), forms: Number(d.forms), applied: Number(d.applied) }));
  const runs = Number(r.assistant.replied) + Number(r.assistant.handed_off) + Number(r.assistant.failed);
  const head2 = { count: "exact" as const, head: true };
  const moves = (actor: string, decision: string) => supabase.from("stage_events").select("*", head2).eq("actor_type", actor).eq("decision", decision).gte("created_at", since);
  const [leftWaiting, aiMoves, aiRejected, personMoves] = await Promise.all([
    supabase.from("tasks").select("*", head2).like("title", "Driver waiting%").gte("created_at", since),
    moves("ai", "applied"),
    moves("ai", "rejected"),
    moves("human", "applied"),
  ]);

  return (
    <>
      {head}
      <div className="space-y-3 px-5 md:px-6">
        <Stagger className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <StaggerItem><Kpi label="Leads" value={f.contacts} hint={`${n(f.contacted)} emailed`} /></StaggerItem>
          <StaggerItem><Kpi label="Replied" value={f.replied} hint={`${pct(f.replied, f.contacted)} of emailed`} /></StaggerItem>
          <StaggerItem><Kpi label="Form sent" value={f.form_sent} hint={`${pct(f.form_sent, f.replied)} of replies`} /></StaggerItem>
          <StaggerItem><Kpi label="Applied" value={f.applied} hint={`${pct(f.applied, f.replied)} reply → form`} /></StaggerItem>
          <StaggerItem><Kpi label="Hired" value={f.hired} hint={`${pct(f.hired, f.applied)} of applied`} /></StaggerItem>
          <StaggerItem><Stat label="Cost per hire" value={f.hired ? usd(total / f.hired) : "—"} hint={f.applied ? `${usd(total / f.applied)} per application` : `${usd(total)} spent`} /></StaggerItem>
        </Stagger>

        <div className="grid gap-3 xl:grid-cols-3">
          <FadeIn delay={0.1} className="xl:col-span-2">
            <Panel title="Activity" sub={sel[2] ? `Last ${sel[1].toLowerCase()}` : "Last 90 days"}><ActivityChart days={days} /></Panel>
          </FadeIn>
          <FadeIn delay={0.15}>
            <Panel title="Funnel" sub={sel[1]}>
              <Funnel steps={[{ label: "Emailed", value: f.contacted }, { label: "Replied", value: f.replied }, { label: "Form sent", value: f.form_sent }, { label: "Applied", value: f.applied }, { label: "Hired", value: f.hired }]} />
            </Panel>
          </FadeIn>
        </div>

        <div className="grid gap-3 xl:grid-cols-3">
          <Panel title="Speed to reply" sub="Driver message → our answer">
            <p className="text-[2rem] font-semibold leading-none tracking-[-0.035em]">{r.speed.median_min == null ? "—" : <><CountUp value={r.speed.median_min} /> <span className="text-[0.95rem] font-normal text-faint">min median</span></>}</p>
            <p className="mt-3 text-[0.8rem] text-muted">90% answered within <span className="font-medium text-fg">{r.speed.p90_min ?? "—"} min</span> · {n(r.speed.samples)} messages</p>
          </Panel>
          <Panel title="Assistant" sub={`${n(runs)} conversations handled`}>
            <Meter parts={[
              { label: "Answered", value: Number(r.assistant.replied), className: "bg-fg" },
              { label: "Handed to a person", value: Number(r.assistant.handed_off), className: "bg-line-strong" },
              { label: "Failed", value: Number(r.assistant.failed), className: "bg-ghost" },
            ]} />
            <p className="mt-4 text-[0.8rem] text-muted">Assistant cost <span className="font-medium text-fg tabular-nums">{usd(Number(r.assistant.cost))}</span></p>
          </Panel>
          <Panel title="Calls" sub="Quo line">
            <dl className="grid grid-cols-3 gap-3">
              {([["Call me now", r.calls.call_requests], ["Calls", r.calls.calls], ["Missed", r.calls.missed]] as const).map(([l, v]) => (
                <div key={l}><dt className="text-[0.75rem] text-muted">{l}</dt><dd className="mt-1 text-[1.35rem] font-semibold tracking-[-0.02em]"><CountUp value={Number(v)} /></dd></div>
              ))}
            </dl>
            <p className="mt-3 text-[0.78rem] text-faint">Missed calls get a text back automatically.</p>
          </Panel>
        </div>

        <Panel title="How far to trust the assistant" sub={sel[1]}>
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {([["Drivers left waiting", leftWaiting.count, "Should be zero: the assistant couldn't answer and a person was alerted"], ["Cards it moved", aiMoves.count, "With the driver's words as proof"], ["Moves the rules stopped", aiRejected.count, "It proposed something the rules wouldn't allow"], ["Cards people moved", personMoves.count, "Each one takes over from the assistant"]] as const).map(([l, v, h]) => (
              <div key={l}><dt className="text-[0.8rem] text-muted">{l}</dt><dd className="mt-1 text-[1.35rem] font-semibold tracking-[-0.02em]"><CountUp value={v ?? 0} /></dd><p className="mt-1 text-[0.75rem] leading-snug text-faint">{h}</p></div>
            ))}
          </dl>
        </Panel>

        <Panel title="Form follow-ups" sub="After a driver gets the link">
          <p className="text-[0.875rem] text-muted">{n(r.chase.chased)} drivers got the link and didn&apos;t fill it right away. <span className="font-medium text-fg">{n(r.chase.completed_after)} ({pct(r.chase.completed_after, r.chase.chased)})</span> filled it during the follow-ups.</p>
          {steps.length > 0 && <div className="mt-4"><BarList items={steps.map(([s, c]) => ({ label: `After follow-up #${s}`, value: Number(c) }))} /></div>}
        </Panel>

        <Table title="By campaign" rows={r.by_campaign} first="members" extra={(x) => { const o = x.stats?.overall ?? {}; const sent = o.emails_sent_count ?? o.sent ?? 0; const rep = o.reply_count ?? o.replies ?? 0; return sent ? `${n(sent)} sent · ${pct(rep, sent)} reply` : x.status ?? ""; }} empty="No campaigns yet." />
        <div className="grid gap-3 xl:grid-cols-2">
          <Table title="By lead tier" rows={r.by_tier} first="total" empty="No leads yet." />
          <Table title="By source" rows={r.by_source} first="total" empty="No leads yet." />
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <Panel title="Forms" sub="Submissions in this range">
            {r.forms.length ? <BarList items={r.forms.map((x) => ({ label: x.name, value: Number(x.submissions) }))} /> : <Empty title="No forms yet" />}
          </Panel>
          <Panel title="Monthly costs" sub={`Spend in this range: ${usd(total)} (${usd(fixed)} fixed + ${usd(Number(r.assistant.cost))} assistant)`}>
            <CostsForm initial={r.costs} canEdit={staff.can("settings.manage")} />
          </Panel>
        </div>
      </div>
    </>
  );
}

function Table({ title, rows, first, extra, empty }: { title: string; rows: Row[]; first: "total" | "members"; extra?: (r: Row) => string; empty: string }) {
  return (
    <Card className="overflow-x-auto">
      <div className="px-5 pb-1 pt-4"><h2 className="text-[0.95rem] font-medium tracking-[-0.01em]">{title}</h2></div>
      {rows.length ? (
        <table className="w-full min-w-[40rem] text-[0.84rem]">
          <thead>
            <tr className="text-left text-[0.75rem] text-muted">
              <th className="px-5 py-2 font-medium">Name</th>
              <th className="px-3 py-2 text-right font-medium">Leads</th>
              <th className="px-3 py-2 text-right font-medium">Replied</th>
              <th className="px-3 py-2 text-right font-medium">Applied</th>
              <th className="px-3 py-2 text-right font-medium">Reply → form</th>
              <th className="px-3 py-2 text-right font-medium">Hired</th>
              {extra && <th className="px-5 py-2 text-right font-medium">Email</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((x) => (
              <tr key={x.name} className="transition-colors hover:bg-subtle">
                <td className="px-5 py-2.5">{x.name}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{n(x[first] ?? 0)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{n(x.replied)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{n(x.applied)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted">{pct(x.applied, x.replied)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{n(x.hired)}</td>
                {extra && <td className="px-5 py-2.5 text-right text-xs text-faint">{extra(x)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="px-5 py-6 text-sm text-faint">{empty}</p>}
    </Card>
  );
}

async function sinceFor(days: number | null) {
  return days ? new Date(Date.now() - days * 86400_000).toISOString() : "2020-01-01T00:00:00Z";
}
function monthsSinceStart() {
  return Math.ceil((Date.now() - new Date("2026-11-01").getTime()) / (30 * 86400_000));
}
