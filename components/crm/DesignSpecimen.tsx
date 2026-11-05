import Link from "next/link";
import { Sidebar } from "@/components/crm/Sidebar";
import { Avatar, Badge, Empty, LinkTabs, PageHead, Panel, StageBadge, btnAccentCls, btnCls, btnDangerCls, btnGhostCls, inputCls, selectCls } from "@/components/crm/ui";
import { BarList, Funnel, Meter } from "@/components/crm/charts";
import { CHART } from "@/lib/crm/chart-colors";
import { FadeIn, Stagger, StaggerItem } from "@/components/crm/motion";
import { ActivityChart, Kpi, type Daily } from "@/components/crm/DashboardBits";
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
const col = (k: keyof Daily) => DAYS.map((d) => Number(d[k]));

const DRIVERS = ["Marcus Reed", "Luis Ortega", "Dana Whitfield", "Ray Delgado", "Tasha Brooks", "Omar Haddad"];

export function DesignSpecimen() {
  return (
    <div className="-m-0 flex">
      <Sidebar allowed={SECTIONS.map((s) => s.href)} me={{ name: "George Bodistean", role: "Admin" }} />
      <div className="min-w-0 flex-1">
        <PageHead title="Good evening, George" sub="Thursday, November 5 · Recruiting pipeline for Global Runners Logistics"
          right={<><Link href="#" className={btnGhostCls}>Open inbox</Link><Link href="#" className={btnCls}>Campaigns</Link></>} />
        <div className="space-y-6 p-5 md:p-8">
          <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StaggerItem><Kpi label="Driver replies" value={84} delta={{ diff: 12, label: "vs prior 7 days" }} hint="email + text" spark={col("replies")} color={CHART.signal} /></StaggerItem>
            <StaggerItem><Kpi label="Our answers" value={131} delta={{ diff: 18, label: "last 7 days" }} hint="assistant + team" spark={col("answered")} /></StaggerItem>
            <StaggerItem><Kpi label="Waiting on a form" value={37} hint="11 being followed up" spark={col("forms")} color={CHART.dusk} /></StaggerItem>
            <StaggerItem><Kpi label="Applied" value={19} delta={{ diff: -2, label: "6 this week" }} hint="4 hired" spark={col("applied")} /></StaggerItem>
          </Stagger>

          <div className="grid gap-6 xl:grid-cols-3">
            <FadeIn delay={0.1} className="xl:col-span-2"><Panel title="Activity" sub="Last 30 days, Las Vegas time"><ActivityChart days={DAYS} /></Panel></FadeIn>
            <FadeIn delay={0.15}>
              <Panel title="Leads by tier" sub="19,997 contacts" right={<span className="text-[0.78rem] text-muted">All →</span>}>
                <BarList accentFirst items={[3060, 1153, 986, 5939, 8859].map((v, i) => ({ tag: String(i + 1), label: TIERS[i + 1], value: v }))} />
              </Panel>
            </FadeIn>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Panel title="Funnel" sub="Contacts at each step or past it">
              <Funnel steps={[{ label: "Contacted", value: 8420 }, { label: "Replied", value: 412 }, { label: "Interested", value: 196 }, { label: "Form sent", value: 141 }, { label: "Applied", value: 46 }, { label: "Hired", value: 9 }]} />
            </Panel>
            <Panel title="Latest replies" bodyClass="p-2">
              <ul>
                {DRIVERS.slice(0, 5).map((n, i) => (
                  <li key={n} className="flex items-center gap-3 rounded-[8px] px-3 py-2.5 hover:bg-subtle">
                    <Avatar name={n} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-[0.84rem] font-medium">{n}</span><span className="block truncate text-[0.75rem] text-faint">{["Reed Trucking LLC", "Ortega Freight", "DW Transport", "Delgado Express", "Brooks Haul"][i]}</span></span>
                    <span className="flex flex-col items-end gap-1"><StageBadge stage={["replied", "interested", "form_sent", "applied", "hired"][i]} /><span className="text-[0.7rem] text-faint">{[2, 14, 38, 60, 120][i]}m</span></span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Assistant" sub="How conversations ended, 30 days">
              <p className="text-[1.85rem] font-semibold tracking-[-0.03em]">212 <span className="text-[0.9rem] font-normal text-faint">runs</span></p>
              <div className="mt-4"><Meter parts={[{ label: "Answered", value: 171, className: "bg-navy" }, { label: "Handed to Ken", value: 33, className: "bg-signal" }, { label: "Failed", value: 8, className: "bg-ghost" }]} /></div>
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

          <div className="grid gap-6 xl:grid-cols-2">
            <Panel title="Conversation" bodyClass="bg-subtle/60">
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
