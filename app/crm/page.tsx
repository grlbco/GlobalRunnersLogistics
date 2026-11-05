import Link from "next/link";
import { Suspense } from "react";
import { requireStaff } from "@/lib/crm/auth";
import { FUNNEL, STAGES, TIERS, stageLabel } from "@/lib/crm/stages";
import { ago, fullName } from "@/lib/crm/format";
import { Avatar, Empty, PageHead, Panel, Skeleton, StageBadge, btnCls, btnGhostCls } from "@/components/crm/ui";
import { BarList, Funnel } from "@/components/crm/charts";
import { FadeIn, Stagger, StaggerItem } from "@/components/crm/motion";
import { ActivityChart, Kpi, windowDelta, type Daily } from "@/components/crm/DashboardBits";
import { CHART } from "@/lib/crm/chart-colors";
import { GoLive } from "@/components/crm/GoLive";

export default function Dashboard() {
  return (
    <Suspense fallback={<Loading />}>
      <Body />
    </Suspense>
  );
}

function Loading() {
  return (
    <div>
      <div className="border-b border-line px-5 pb-5 pt-7 md:px-8"><Skeleton className="h-7 w-56" /><Skeleton className="mt-2 h-4 w-80" /></div>
      <div className="grid gap-4 p-5 sm:grid-cols-2 md:p-8 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}</div>
      <div className="px-5 md:px-8"><Skeleton className="h-80" /></div>
    </div>
  );
}

async function count(q: PromiseLike<{ count: number | null }>) {
  return (await q).count ?? 0;
}

function greeting() {
  const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Los_Angeles" }));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

async function Body() {
  const { supabase, staff } = await requireStaff("/crm", "dashboard.view");
  const head = { count: "exact" as const, head: true };

  const [total, byStage, byTier, daily, recent, tasks] = await Promise.all([
    count(supabase.from("contacts").select("*", head)),
    Promise.all(STAGES.map(async (s) => [s.key, await count(supabase.from("contacts").select("*", head).eq("stage", s.key))] as const)),
    Promise.all([1, 2, 3, 4, 5].map(async (t) => [t, await count(supabase.from("contacts").select("*", head).eq("tier", t))] as const)),
    supabase.rpc("crm_daily", { p_days: 30 }),
    supabase.from("contacts").select("id, first_name, last_name, company_name, stage, last_inbound_at").not("last_inbound_at", "is", null).order("last_inbound_at", { ascending: false }).limit(6),
    supabase.from("tasks").select("id, title, due_at, contact:contacts(id, first_name, last_name, company_name)").is("done_at", null).order("due_at", { nullsFirst: false }).limit(6),
  ]);
  const stage = Object.fromEntries(byStage) as Record<string, number>;
  const days = ((daily.data ?? []) as Daily[]).map((d) => ({ ...d, replies: Number(d.replies), answered: Number(d.answered), forms: Number(d.forms), applied: Number(d.applied) }));
  const col = (k: keyof Daily) => days.map((d) => Number(d[k]));
  const reached = (key: string) => {
    // contacts at this stage or any later stage (every in-between stage counts, e.g. Following up, With Ken)
    const ORDER = ["contacted", "replied", "interested", "form_sent", "chasing", "applied", "qualified", "sent_to_ken", "hired"];
    const later = ORDER.slice(Math.max(0, ORDER.indexOf(key)));
    return later.reduce((s, k) => s + (stage[k] ?? 0), 0) + (key === "contacted" ? ["nurture", "not_fit", "not_interested", "unsubscribed", "bounced"].reduce((s, k) => s + (stage[k] ?? 0), 0) : 0);
  };
  const applied = (stage.applied ?? 0) + (stage.qualified ?? 0) + (stage.sent_to_ken ?? 0);
  const replies7 = windowDelta(col("replies"));
  const answered7 = windowDelta(col("answered"));
  const applied7 = windowDelta(col("applied"));
  const now = new Date().getTime();
  const first = staff.name.split(" ")[0];
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Los_Angeles" });

  return (
    <>
      <PageHead
        title={`${greeting()}, ${first}`}
        sub={`${today} · Recruiting pipeline for Global Runners Logistics`}
        right={<>
          <Link href="/crm/inbox" className={btnGhostCls}>Open inbox</Link>
          {staff.can("campaigns.manage") && <Link href="/crm/campaigns" className={btnCls}>Campaigns</Link>}
        </>}
      />
      <div className="space-y-6 p-5 md:p-8">
        <Suspense fallback={<Skeleton className="h-40" />}>
          <FadeIn><GoLive isAdmin={staff.can("settings.manage")} /></FadeIn>
        </Suspense>

        <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StaggerItem><Kpi label="Driver replies" value={replies7.now} delta={{ diff: replies7.diff, label: "vs prior 7 days" }} hint="email + text" spark={col("replies")} color={CHART.signal} /></StaggerItem>
          <StaggerItem><Kpi label="Our answers" value={answered7.now} delta={{ diff: answered7.diff, label: "last 7 days" }} hint="assistant + team" spark={col("answered")} /></StaggerItem>
          <StaggerItem><Kpi label="Waiting on a form" value={(stage.form_sent ?? 0) + (stage.chasing ?? 0)} hint={`${(stage.chasing ?? 0).toLocaleString("en-US")} being followed up`} spark={col("forms")} color={CHART.dusk} /></StaggerItem>
          <StaggerItem><Kpi label="Applied" value={applied} delta={{ diff: applied7.diff, label: `${applied7.now} this week` }} hint={`${(stage.hired ?? 0).toLocaleString("en-US")} hired`} spark={col("applied")} color={CHART.navy} /></StaggerItem>
        </Stagger>

        <div className="grid gap-6 xl:grid-cols-3">
          <FadeIn delay={0.1} className="xl:col-span-2">
            <Panel title="Activity" sub="Last 30 days, Las Vegas time">
              <ActivityChart days={days} />
            </Panel>
          </FadeIn>
          <FadeIn delay={0.15}>
            <Panel title="Leads by tier" sub={`${total.toLocaleString("en-US")} contacts`} right={<Link href="/crm/contacts" className="text-[0.78rem] text-muted hover:text-fg">All →</Link>}>
              <BarList accentFirst items={byTier.map(([t, v]) => ({ tag: String(t), label: TIERS[t], value: v, href: `/crm/contacts?tier=${t}` }))} />
            </Panel>
          </FadeIn>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <FadeIn delay={0.2}>
            <Panel title="Funnel" sub="Contacts at each step or past it">
              <Funnel steps={FUNNEL.map((k) => ({ label: stageLabel(k), value: reached(k) }))} />
            </Panel>
          </FadeIn>

          <FadeIn delay={0.25}>
            <Panel title="Latest replies" right={<Link href="/crm/inbox" className="text-[0.78rem] text-muted hover:text-fg">Inbox →</Link>} bodyClass="p-2">
              {recent.data?.length ? (
                <ul>
                  {recent.data.map((c) => (
                    <li key={c.id}>
                      <Link href={`/crm/contacts/${c.id}`} className="flex items-center gap-3 rounded-[8px] px-3 py-2.5 transition-colors hover:bg-subtle">
                        <Avatar name={fullName(c)} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.84rem] font-medium">{fullName(c)}</span>
                          <span className="block truncate text-[0.75rem] text-faint">{c.company_name}</span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1"><StageBadge stage={c.stage} /><span className="text-[0.7rem] text-faint">{ago(c.last_inbound_at)}</span></span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : <div className="p-3"><Empty title="No replies yet">They show up here the moment the first campaign gets an answer.</Empty></div>}
            </Panel>
          </FadeIn>

          <FadeIn delay={0.3}>
            <Panel title="Open tasks" bodyClass="p-2">
              {tasks.data?.length ? (
                <ul>
                  {tasks.data.map((t) => {
                    const c = t.contact as unknown as { id: string; first_name: string | null; last_name: string | null; company_name: string | null } | null;
                    const late = t.due_at && new Date(t.due_at).getTime() < now;
                    return (
                      <li key={t.id} className="flex items-start gap-3 rounded-[8px] px-3 py-2.5 transition-colors hover:bg-subtle">
                        <span className={late ? "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" : "mt-1.5 h-2 w-2 shrink-0 rounded-full border border-line-strong"} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.84rem]">{t.title}</span>
                          {c && <Link href={`/crm/contacts/${c.id}`} className="block truncate text-[0.75rem] text-faint hover:text-fg">{fullName(c)}</Link>}
                        </span>
                        {t.due_at && <span className={late ? "shrink-0 text-[0.72rem] font-medium text-red-600" : "shrink-0 text-[0.72rem] text-faint"}>{new Date(t.due_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>}
                      </li>
                    );
                  })}
                </ul>
              ) : <div className="p-3"><Empty title="All clear">No open tasks.</Empty></div>}
            </Panel>
          </FadeIn>
        </div>
      </div>
    </>
  );
}
