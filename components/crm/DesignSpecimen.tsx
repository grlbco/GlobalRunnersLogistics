import Link from "next/link";
import { Sidebar } from "@/components/crm/Sidebar";
import { TopBar } from "@/components/crm/TopBar";
import { ICONS, Insights } from "@/components/crm/Insights";
import { Avatar, Badge, Empty, LinkTabs, PageHead, Panel, StageBadge, btnAccentCls, btnCls, btnDangerCls, btnGhostCls, inputCls, selectCls } from "@/components/crm/ui";
import { Meter } from "@/components/crm/charts";
import { FadeIn, Stagger, StaggerItem } from "@/components/crm/motion";
import { ActivityChart, FunnelStrip, Kpi, type Daily } from "@/components/crm/DashboardBits";
import { SECTIONS } from "@/lib/crm/permissions";
import { Board } from "@/components/crm/Board";
import { Timeline, type Item } from "@/components/crm/Timeline";
import { Composer } from "@/components/crm/Composer";
import { TIERS } from "@/lib/crm/stages";

// deterministic sample data (no randomness, so screenshots are stable)
const wave = (i: number, a: number, b: number, c: number) => Math.max(0, Math.round(a + b * Math.sin(i / 3.1) + c * Math.cos(i / 1.7) + i * 0.35));
const DAYS: Daily[] = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 9, 7 + i));
  return { day: d.toISOString().slice(0, 10), replies: wave(i, 9, 5, 3), answered: wave(i, 12, 6, 2), forms: wave(i, 3, 2, 1), applied: wave(i, 1, 1.4, 0.8) };
});

const DRIVERS = ["Marcus Reed", "Luis Ortega", "Dana Whitfield", "Ray Delgado", "Tasha Brooks", "Omar Haddad"];

export function DesignSpecimen() {
  return (
    <div className="-m-0 flex">
      <Sidebar allowed={SECTIONS.map((s) => s.href)} me={{ name: "George Bodistean", role: "Admin" }} />
      <div className="min-w-0 flex-1">
        <TopBar me={{ name: "George Bodistean" }} team={{ names: ["Ken Aman", "Marcus Reed"], total: 4, href: "#" }} unread={3} canSearch />
        <PageHead greeting={<>👋 Evening, <span className="font-medium text-fg">George</span></>} title="Recruiting overview"
          right={<><Link href="#" className={btnGhostCls}>Open inbox</Link><Link href="#" className={btnCls}>Campaigns</Link></>} />
        <div className="space-y-3 px-5 md:px-6">
          <Stagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StaggerItem><Kpi label="Driver replies" href="#" value={84} delta={{ diff: 12, label: "vs. prior 7 days" }} /></StaggerItem>
            <StaggerItem><Kpi label="Our answers" href="#" value={131} delta={{ diff: 18, label: "vs. prior 7 days" }} /></StaggerItem>
            <StaggerItem><Kpi label="Waiting on a form" href="#" value={37} hint="11 being followed up" /></StaggerItem>
            <StaggerItem><Kpi label="Applied" href="#" value={19} delta={{ diff: -2, label: "vs. prior 7 days" }} /></StaggerItem>
          </Stagger>
          <div className="grid items-start gap-3 xl:grid-cols-4">
            <div className="min-w-0 space-y-3 xl:col-span-3">
              <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
                <FadeIn delay={0.06} className="min-w-0"><Panel title="Activity" className="h-full"><ActivityChart days={DAYS} selectable /></Panel></FadeIn>
                <FadeIn delay={0.1} className="min-w-0">
                  <Panel title="Leads by tier" className="h-full">
                    <table className="w-full text-[0.84rem]">
                      <thead><tr className="text-left text-[0.78rem] text-muted"><th className="pb-3 font-normal">Tier</th><th className="pb-3 text-right font-normal">Contacts</th><th className="pb-3 text-right font-normal">Replied</th><th className="pb-3 text-right font-normal">Rate</th></tr></thead>
                      <tbody>
                        {[[3060, 92], [1153, 41], [986, 22], [5939, 118], [8859, 139]].map(([v, r], i) => (
                          <tr key={i}><td className="py-2.5 pr-2">{TIERS[i + 1]}</td><td className="py-2.5 text-right tabular-nums text-fg-2">{v.toLocaleString("en-US")}</td><td className="py-2.5 text-right tabular-nums text-fg-2">{r}</td><td className="py-2.5 text-right tabular-nums text-muted">{Math.round((r / v) * 1000) / 10}%</td></tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-4 text-[0.875rem]">19,997 contacts</p>
                    <p className="mt-0.5 text-[0.8rem] text-muted">Replied means the driver has written back at least once</p>
                  </Panel>
                </FadeIn>
              </div>
              <Panel title="Pipeline">
                <FunnelStrip steps={[{ label: "Contacted", value: 8420 }, { label: "Replied", value: 412 }, { label: "Interested", value: 196 }, { label: "Form sent", value: 141 }, { label: "Applied", value: 46 }, { label: "Hired", value: 9 }]} />
                <p className="mt-5 text-[0.875rem]">46 of 8,420 contacted drivers have applied</p>
                <p className="mt-0.5 text-[0.8rem] text-muted">Each step counts drivers at that stage or further along</p>
              </Panel>
              <div className="grid gap-3 lg:grid-cols-2">
                <Panel title="Latest replies" bodyClass="!px-2 !pt-1 !pb-2">
                  <ul>
                    {DRIVERS.slice(0, 5).map((n, i) => (
                      <li key={n} className="flex items-center gap-3 rounded-[12px] px-3 py-2.5 hover:bg-hover">
                        <Avatar name={n} />
                        <span className="min-w-0 flex-1"><span className="block truncate text-[0.875rem] font-medium">{n}</span><span className="block truncate text-[0.78rem] text-muted">{["Reed Trucking LLC", "Ortega Freight", "DW Transport", "Delgado Express", "Brooks Haul"][i]}</span></span>
                        <span className="flex flex-col items-end gap-1"><StageBadge stage={["replied", "interested", "form_sent", "applied", "hired"][i]} /><span className="text-[0.72rem] text-faint">{[2, 14, 38, 60, 120][i]}m</span></span>
                      </li>
                    ))}
                  </ul>
                </Panel>
                <Panel title="Assistant" sub="How conversations ended, 30 days">
                  <p className="text-[2rem] font-semibold tracking-[-0.03em]">212 <span className="text-[0.9rem] font-normal text-faint">runs</span></p>
                  <div className="mt-4"><Meter parts={[{ label: "Answered", value: 171, className: "bg-fg" }, { label: "Handed to Ken", value: 33, className: "bg-line-strong" }, { label: "Failed", value: 8, className: "bg-red-500" }]} /></div>
                </Panel>
              </div>
            </div>
            <Panel title="Needs attention" bodyClass="!pt-4">
              <Insights items={[
                { title: "2 messages failed to send", detail: "The driver didn't get it", action: { label: "View inbox", href: "#" }, tone: "bad", icon: ICONS.alert },
                { title: "3 tasks overdue", detail: "Past the time they were due", action: { label: "View drivers", href: "#" }, tone: "bad", icon: ICONS.clock },
                { title: "3 unread conversations", detail: "Drivers wrote and nobody has opened it", action: { label: "Open unread", href: "#" }, tone: "bad", icon: ICONS.inbox },
                { title: "5 drafts to approve", detail: "Assistant replies waiting for your OK", action: { label: "Review drafts", href: "#" }, tone: "warn", icon: ICONS.edit },
                { title: "37 drivers waiting on a form", detail: "11 being followed up", action: { label: "View pipeline", href: "#" }, tone: "warn", icon: ICONS.form },
                { title: "19 applications in progress", detail: "4 hired so far", action: { label: "View pipeline", href: "#" }, tone: "good", icon: ICONS.check },
              ]} />
            </Panel>
          </div>

          <Panel title="Pipeline" sub="Drag between stages" bodyClass="p-0">
            <Board columns={[
              { stage: "replied", label: "Replied", count: 26, items: [0, 1, 2].map((i) => ({ id: `r${i}`, name: DRIVERS[i], company: ["Reed Trucking LLC", "Ortega Freight", "DW Transport"][i], place: ["Henderson, NV", "Phoenix, AZ", "Kingman, AZ"][i], when: ["4m", "1h", "3h"][i], email: ["marcus@reedtrucking.com", "luis@ortegafreight.com", null][i], phone: ["(702) 555-0148", null, "(928) 555-0193"][i], tier: [1, 3, 2][i] })) },
              { stage: "interested", label: "Interested", count: 3, items: [{ id: "i1", name: DRIVERS[3], company: "Delgado Express", place: "St. George, UT", when: "12m", email: "ray@delgadoexpress.com", phone: "(435) 555-0110", tier: 1 }] },
              { stage: "form_sent", label: "Form sent", count: 5, items: [{ id: "f1", name: DRIVERS[4], company: "Brooks Haul", place: "Las Vegas, NV", when: "2d", email: null, phone: "(725) 555-0177", tier: 4 }] },
              { stage: "applied", label: "Applied", count: 0, items: [] },
            ]} />
          </Panel>

          <div className="grid gap-3 xl:grid-cols-2">
            <Panel title="Conversation">
              <Timeline oldestFirst items={([
                { kind: "message", at: "2026-11-05T15:02:00Z", channel: "email", direction: "outbound", author: "campaign", subject: "Team driver spot, Henderson NV", body: "Hi Marcus, saw your authority went inactive. We're hiring CDL-A team drivers out of Henderson…", status: "sent" },
                { kind: "message", at: "2026-11-05T15:40:00Z", channel: "email", direction: "inbound", author: "lead", subject: null, body: "What's the pay and how often am I home?", status: "received" },
                { kind: "message", at: "2026-11-05T15:44:00Z", channel: "email", direction: "outbound", author: "agent", subject: null, body: "It's per mile, paid every Thursday, and you're home 4 days. Here's the 2-minute form so Ken can call you: globalrunnerslogistics.com/apply", status: "sent" },
                { kind: "activity", at: "2026-11-05T15:45:00Z", type: "stage_changed", data: { from: "replied", to: "form_sent" }, actor: "agent" },
                { kind: "note", at: "2026-11-05T16:10:00Z", body: "Has a partner already, both 5+ years.", author_kind: "human" },
              ] as Item[])} />
            </Panel>
            <Panel title="Reply">
              <Composer contactId="00000000-0000-0000-0000-000000000000" sendingOn email={{ ok: true }} sms={{ ok: false, why: "No text consent yet" }} />
            </Panel>
          </div>

          <Panel title="Controls" sub="Buttons, inputs, badges, tabs">
            <div className="flex flex-wrap items-center gap-2">
              <button className={btnCls}>Save changes</button>
              <button className={btnAccentCls}>Launch campaign</button>
              <button className={btnGhostCls}>Cancel</button>
              <button className={btnDangerCls}>Delete</button>
              <LinkTabs active="30d" items={[{ key: "7d", label: "7 days", href: "#" }, { key: "30d", label: "30 days", href: "#" }, { key: "90d", label: "90 days", href: "#" }]} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <input className={inputCls} placeholder="Search drivers, companies, USDOT…" />
              <select className={selectCls} defaultValue="1"><option value="1">Tier 1 · Inactive / OOS</option></select>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="good" dot>Live</Badge><Badge tone="warn" dot>Paused</Badge><Badge tone="bad" dot>Failed</Badge><Badge tone="accent">Hot</Badge><Badge tone="info">Draft</Badge><Badge>Neutral</Badge>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {["new", "contacted", "replied", "interested", "form_sent", "chasing", "applied", "qualified", "sent_to_ken", "hired", "not_fit", "unsubscribed"].map((s) => <StageBadge key={s} stage={s} />)}
            </div>
            <div className="mt-6"><Empty title="No campaigns yet" action={<button className={btnCls}>New campaign</button>}>Create a draft, pick a tier, and add a 10-lead pilot wave.</Empty></div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
