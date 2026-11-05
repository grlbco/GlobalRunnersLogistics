import Link from "next/link";
import { Suspense } from "react";
import { requireStaff } from "@/lib/crm/auth";
import { STAGES, TIERS, stageLabel } from "@/lib/crm/stages";
import { ago, fullName } from "@/lib/crm/format";
import { Avatar, Empty, PageHead, Panel, Skeleton, StageBadge, btnCls, btnGhostCls } from "@/components/crm/ui";
import { FadeIn, Stagger, StaggerItem } from "@/components/crm/motion";
import { ActivityChart, FunnelStrip, Kpi } from "@/components/crm/DashboardBits";
import { ICONS, Insights, type Insight } from "@/components/crm/Insights";
import { windowDelta, type Daily } from "@/lib/crm/daily";
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
      <div className="px-5 pb-4 pt-2 md:px-6"><Skeleton className="h-4 w-40" /><Skeleton className="mt-2 h-7 w-56" /></div>
      <div className="grid gap-3 px-5 sm:grid-cols-2 md:px-6 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}</div>
      <div className="mt-3 px-5 md:px-6"><Skeleton className="h-96" /></div>
    </div>
  );
}

async function count(q: PromiseLike<{ count: number | null }>) {
  return (await q).count ?? 0;
}

function greeting() {
  const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Los_Angeles" })) % 24;
  return h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening";
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

async function Body() {
  const { supabase, staff } = await requireStaff("/crm", "dashboard.view");
  const head = { count: "exact" as const, head: true };
  const nowIso = new Date().toISOString();

  const [total, byStage, byTier, daily, recent, tasks, unread, drafts, failed, overdue] = await Promise.all([
    count(supabase.from("contacts").select("*", head)),
    Promise.all(STAGES.map(async (s) => [s.key, await count(supabase.from("contacts").select("*", head).eq("stage", s.key))] as const)),
    Promise.all([1, 2, 3, 4, 5].map(async (t) => [t, await count(supabase.from("contacts").select("*", head).eq("tier", t)), await count(supabase.from("contacts").select("*", head).eq("tier", t).not("last_inbound_at", "is", null))] as const)),
    supabase.rpc("crm_daily", { p_days: 30 }),
    supabase.from("contacts").select("id, first_name, last_name, company_name, stage, last_inbound_at").not("last_inbound_at", "is", null).order("last_inbound_at", { ascending: false }).limit(5),
    supabase.from("tasks").select("id, title, due_at, contact:contacts(id, first_name, last_name, company_name)").is("done_at", null).order("due_at", { nullsFirst: false }).limit(5),
    count(supabase.from("conversations").select("*", head).eq("unread", true)),
    count(supabase.from("outbox").select("*", head).eq("status", "draft")),
    count(supabase.from("outbox").select("*", head).eq("status", "failed")),
    count(supabase.from("tasks").select("*", head).is("done_at", null).lt("due_at", nowIso)),
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
  const waiting = (stage.form_sent ?? 0) + (stage.chasing ?? 0);
  const replies7 = windowDelta(col("replies"));
  const answered7 = windowDelta(col("answered"));
  const applied7 = windowDelta(col("applied"));
  const now = new Date().getTime();
  const first = staff.name.split(" ")[0];

  const insights: Insight[] = [
    failed > 0 && { title: `${plural(failed, "message")} failed to send`, detail: "The driver didn't get it", action: { label: "View inbox", href: "/crm/inbox" }, tone: "bad", icon: ICONS.alert },
    overdue > 0 && { title: `${plural(overdue, "task")} overdue`, detail: "Past the time they were due", action: staff.can("contacts.view") ? { label: "View drivers", href: "/crm/contacts" } : undefined, tone: "bad", icon: ICONS.clock },
    unread > 0 && { title: `${plural(unread, "unread conversation")}`, detail: "Drivers wrote and nobody has opened it", action: { label: "Open unread", href: "/crm/inbox?f=unread" }, tone: "bad", icon: ICONS.inbox },
    drafts > 0 && { title: `${plural(drafts, "draft")} to approve`, detail: "Assistant replies waiting for your OK", action: { label: "Review drafts", href: "/crm/inbox" }, tone: "warn", icon: ICONS.edit },
    waiting > 0 && { title: `${plural(waiting, "driver")} waiting on a form`, detail: `${(stage.chasing ?? 0).toLocaleString("en-US")} being followed up`, action: { label: "View pipeline", href: "/crm/pipeline" }, tone: "warn", icon: ICONS.form },
    applied > 0 && { title: `${plural(applied, "application")} in progress`, detail: `${(stage.hired ?? 0).toLocaleString("en-US")} hired so far`, action: { label: "View pipeline", href: "/crm/pipeline" }, tone: "good", icon: ICONS.check },
  ].filter(Boolean) as Insight[];

  const funnelKeys = ["contacted", "replied", "interested", "form_sent", "applied", "hired"];

  return (
    <>
      <PageHead
        greeting={<>👋 {greeting()}, <span className="font-medium text-fg">{first}</span></>}
        title="Recruiting overview"
        right={<>
          <Link href="/crm/inbox" className={btnGhostCls}>Open inbox</Link>
          {staff.can("campaigns.manage") && <Link href="/crm/campaigns" className={btnCls}>Campaigns</Link>}
        </>}
      />
      <div className="space-y-3 px-5 md:px-6">
        <Stagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StaggerItem><Kpi label="Driver replies" href="/crm/inbox" value={replies7.now} delta={{ diff: replies7.diff, label: "vs. prior 7 days" }} /></StaggerItem>
          <StaggerItem><Kpi label="Our answers" href="/crm/inbox" value={answered7.now} delta={{ diff: answered7.diff, label: "vs. prior 7 days" }} /></StaggerItem>
          <StaggerItem><Kpi label="Waiting on a form" href="/crm/pipeline" value={waiting} hint={`${(stage.chasing ?? 0).toLocaleString("en-US")} being followed up`} /></StaggerItem>
          <StaggerItem><Kpi label="Applied" href="/crm/pipeline" value={applied} delta={{ diff: applied7.diff, label: "vs. prior 7 days" }} /></StaggerItem>
        </Stagger>

        <div className="grid items-start gap-3 xl:grid-cols-4">
          <div className="min-w-0 space-y-3 xl:col-span-3">
            <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
              <FadeIn delay={0.06} className="min-w-0">
                <Panel title="Activity" className="h-full"><ActivityChart days={days} selectable /></Panel>
              </FadeIn>
              <FadeIn delay={0.1} className="min-w-0">
                <Panel title="Leads by tier" className="h-full" right={<Link href="/crm/contacts" className="text-[0.8rem] text-muted transition-colors hover:text-fg">All contacts</Link>}>
                  <table className="w-full text-[0.84rem]">
                    <thead>
                      <tr className="text-left text-[0.78rem] text-muted">
                        <th className="pb-3 font-normal">Tier</th>
                        <th className="pb-3 text-right font-normal">Contacts</th>
                        <th className="pb-3 text-right font-normal">Replied</th>
                        <th className="pb-3 text-right font-normal">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byTier.map(([t, v, r]) => (
                        <tr key={t} className="group">
                          <td className="py-2.5 pr-2"><Link href={`/crm/contacts?tier=${t}`} className="block truncate text-fg underline-offset-4 group-hover:underline">{TIERS[t]}</Link></td>
                          <td className="py-2.5 text-right tabular-nums text-fg-2">{v.toLocaleString("en-US")}</td>
                          <td className="py-2.5 text-right tabular-nums text-fg-2">{r.toLocaleString("en-US")}</td>
                          <td className="py-2.5 text-right tabular-nums text-muted">{v ? `${Math.round((r / v) * 1000) / 10}%` : "0%"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-4 text-[0.875rem] text-fg">{total.toLocaleString("en-US")} contacts</p>
                  <p className="mt-0.5 text-[0.8rem] text-muted">Replied means the driver has written back at least once</p>
                </Panel>
              </FadeIn>
            </div>

            <FadeIn delay={0.14}>
              <Panel title="Pipeline">
                <FunnelStrip steps={funnelKeys.map((k) => ({ label: stageLabel(k), value: reached(k), href: staff.can("contacts.view") ? `/crm/contacts?stage=${k}` : undefined }))} />
                <p className="mt-5 text-[0.875rem] text-fg">{reached("applied").toLocaleString("en-US")} of {reached("contacted").toLocaleString("en-US")} contacted drivers have applied</p>
                <p className="mt-0.5 text-[0.8rem] text-muted">Each step counts drivers at that stage or further along</p>
              </Panel>
            </FadeIn>

            <div className="grid gap-3 lg:grid-cols-2">
              <FadeIn delay={0.18} className="min-w-0">
                <Panel title="Latest replies" className="h-full" right={<Link href="/crm/inbox" className="text-[0.8rem] text-muted transition-colors hover:text-fg">Inbox</Link>} bodyClass="!px-2 !pt-1 !pb-2">
                  {recent.data?.length ? (
                    <ul>
                      {recent.data.map((c) => (
                        <li key={c.id}>
                          <Link href={`/crm/contacts/${c.id}`} className="flex items-center gap-3 rounded-[12px] px-3 py-2.5 transition-colors duration-150 hover:bg-hover">
                            <Avatar name={fullName(c)} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[0.875rem] font-medium">{fullName(c)}</span>
                              <span className="block truncate text-[0.78rem] text-muted">{c.company_name}</span>
                            </span>
                            <span className="flex shrink-0 flex-col items-end gap-1"><StageBadge stage={c.stage} /><span className="text-[0.72rem] text-faint">{ago(c.last_inbound_at)}</span></span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : <div className="p-3"><Empty title="No replies yet">They show up here the moment the first campaign gets an answer.</Empty></div>}
                </Panel>
              </FadeIn>

              <FadeIn delay={0.2} className="min-w-0">
                <Panel title="Open tasks" className="h-full" bodyClass="!px-2 !pt-1 !pb-2">
                  {tasks.data?.length ? (
                    <ul>
                      {tasks.data.map((t) => {
                        const c = t.contact as unknown as { id: string; first_name: string | null; last_name: string | null; company_name: string | null } | null;
                        const late = t.due_at && new Date(t.due_at).getTime() < now;
                        return (
                          <li key={t.id} className="flex items-start gap-3 rounded-[12px] px-3 py-2.5 transition-colors duration-150 hover:bg-hover">
                            <span className={late ? "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" : "mt-1.5 h-2 w-2 shrink-0 rounded-full border border-line-strong"} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[0.875rem]">{t.title}</span>
                              {c && <Link href={`/crm/contacts/${c.id}`} className="block truncate text-[0.78rem] text-muted hover:text-fg">{fullName(c)}</Link>}
                            </span>
                            {t.due_at && <span className={late ? "shrink-0 text-[0.72rem] font-medium text-red-600" : "shrink-0 text-[0.72rem] text-faint"}>{new Date(t.due_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  ) : <div className="p-3"><Empty title="No open tasks">Tasks you or the assistant add to a driver appear here.</Empty></div>}
                </Panel>
              </FadeIn>
            </div>

            <Suspense fallback={<Skeleton className="h-40" />}>
              <FadeIn delay={0.2}><GoLive isAdmin={staff.can("settings.manage")} /></FadeIn>
            </Suspense>
          </div>

          <FadeIn delay={0.1} className="min-w-0">
            <Panel title="Needs attention" bodyClass="!pt-4">
              {insights.length ? <Insights items={insights} /> : <Insights items={[{ title: "Nothing waiting on you", detail: "New replies, drafts and overdue tasks will show up here", tone: "quiet", icon: ICONS.check }]} />}
            </Panel>
          </FadeIn>
        </div>
      </div>
    </>
  );
}
