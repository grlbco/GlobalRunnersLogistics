import { Suspense } from "react";
import { requireStaff } from "@/lib/crm/auth";
import { getAssistantSettings } from "@/lib/crm/settings";
import { OFFER_FACTS } from "@/lib/agent/knowledge";
import { saveAssistantSettings, setAssistantEnabled } from "@/app/crm/actions";
import { clsx } from "clsx";
import { LiveDot } from "@/components/crm/motion";
import { btnAccentCls, btnCls, btnGhostCls, Card, inputCls, Label, PageHead, Skeleton } from "@/components/crm/ui";
import { AssistantTest } from "@/components/crm/AssistantTest";
import { ago, n } from "@/lib/crm/format";

export const metadata = { title: "Assistant" };

export default function AssistantPage() {
  return (
    <>
      <PageHead title="Assistant" sub="Replies to drivers by email and text, remembers each one, follows up until the form is done" />
      <Suspense fallback={<div className="p-8"><Skeleton className="h-96" /></div>}>
        <Body />
      </Suspense>
    </>
  );
}

async function Body() {
  const { supabase, staff } = await requireStaff("/crm/assistant", "assistant.view");
  const s = await getAssistantSettings();
  const since = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const [{ data: runs }, { data: today }, { data: approvals }] = await Promise.all([
    supabase.from("agent_runs").select("trigger, action, reply, decision, cost_usd, created_at, contact:contacts(id, first_name, last_name)").order("created_at", { ascending: false }).limit(15),
    supabase.from("agent_runs").select("action, cost_usd").gte("created_at", since),
    supabase.from("activities").select("data").eq("type", "draft_approved").limit(5000),
  ]);
  const approved = approvals?.length ?? 0;
  const edits = (approvals ?? []).filter((a) => (a.data as { edited?: boolean } | null)?.edited).length;
  const spent = (today ?? []).reduce((t, r) => t + Number(r.cost_usd ?? 0), 0);
  const replied = (today ?? []).filter((r) => r.action === "replied" || r.action === "draft").length;
  const handed = (today ?? []).filter((r) => r.action === "handed_off").length;
  const admin = staff.can("assistant.manage");

  return (
    <div className="grid gap-3 px-5 md:px-6 xl:grid-cols-[24rem_1fr]">
      <form action={setAssistantEnabled} className={clsx("flex flex-wrap items-center justify-between gap-4 rounded-[16px] border p-5 shadow-card xl:col-span-2", s.enabled ? "border-emerald-200 bg-emerald-50/70" : "border-amber-200 bg-amber-50/70")}>
        <input type="hidden" name="on" value={s.enabled ? "0" : "1"} />
        <div>
          <p className="flex items-center gap-2.5 text-[1.05rem] font-semibold tracking-[-0.02em]"><LiveDot on={s.enabled} />{s.enabled ? "Assistant is on" : "Assistant is off"}</p>
          <p className="mt-1 text-sm text-muted">
            {s.enabled
              ? s.draft_mode ? "It writes replies as drafts; you approve each one." : "It replies 24/7 within minutes. Follow-up texts it starts itself go out 8am–9pm driver time."
              : "Nobody gets automatic replies. Turning it on also answers drivers waiting from the last 48 hours."}
          </p>
        </div>
        {admin && <button className={s.enabled ? btnGhostCls : btnAccentCls}>{s.enabled ? "Turn off" : "Turn on"}</button>}
      </form>
      <div className="space-y-6">
        <Card className="p-5">
          <Label>Settings</Label>
          <form action={saveAssistantSettings} className="mt-4 space-y-4 text-sm">
            <input type="hidden" name="enabled" value={s.enabled ? "on" : ""} />
            <label className="flex items-center justify-between gap-3">
              <span>Draft mode<span className="block text-xs text-faint">You approve every message before it sends{s.draft_mode && s.auto_after ? ` · ${Math.min(approved, s.auto_after)} of ${s.auto_after} approved${edits ? ` (${edits} edited)` : ""}, then it switches to automatic by itself if under 20% needed edits` : ""}</span></span>
              <input type="checkbox" name="draft_mode" defaultChecked={s.draft_mode} disabled={!admin} className="h-5 w-5 accent-[#e8401c]" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1"><span className="text-xs text-faint">Reply delay from (min)</span><input name="delay_min_m" type="number" defaultValue={Math.round(s.delay_min_s / 60)} className={inputCls} disabled={!admin} /></label>
              <label className="space-y-1"><span className="text-xs text-faint">to (min)</span><input name="delay_max_m" type="number" defaultValue={Math.round(s.delay_max_s / 60)} className={inputCls} disabled={!admin} /></label>
              <label className="space-y-1"><span className="text-xs text-faint">Max messages / driver / day</span><input name="max_per_day" type="number" defaultValue={s.max_per_day} className={inputCls} disabled={!admin} /></label>
              <label className="space-y-1"><span className="text-xs text-faint">Max follow-ups</span><input name="max_followups" type="number" defaultValue={s.max_followups} className={inputCls} disabled={!admin} /></label>
            </div>
            <p className="text-xs text-faint">Replies to drivers go out 24/7. Follow-up texts the assistant or an automation starts wait for 8am–9pm in the driver&apos;s time zone (federal + state quiet-hour laws). Email has no time limit. STOP and opt-outs are handled in code first.</p>
            {admin && <button className={btnCls}>Save</button>}
          </form>
        </Card>
        <Card className="p-5">
          <Label>Today</Label>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div><p className="text-2xl font-semibold tabular-nums">{n(replied)}</p><p className="text-xs text-faint">replies</p></div>
            <div><p className="text-2xl font-semibold tabular-nums">{n(handed)}</p><p className="text-xs text-faint">to a person</p></div>
            <div><p className="text-2xl font-semibold tabular-nums">${spent.toFixed(2)}</p><p className="text-xs text-faint">spent</p></div>
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="p-5">
          <Label>Test it</Label>
          <p className="mt-1 text-xs text-faint">Write as a driver. Uses your test contact&apos;s history and memory. Nothing is saved or sent.</p>
          <div className="mt-4"><AssistantTest /></div>
        </Card>
        <Card className="p-5">
          <Label>Recent decisions</Label>
          {runs?.length ? (
            <ul className="mt-3 divide-y divide-line text-sm">
              {runs.map((r, i) => {
                const c = r.contact as unknown as { id: string; first_name: string | null; last_name: string | null } | null;
                return (
                  <li key={i} className="py-2.5">
                    <div className="flex justify-between gap-3 text-xs"><a href={c ? `/crm/contacts/${c.id}` : "#"} className="text-muted hover:text-fg">{c ? [c.first_name, c.last_name].filter(Boolean).join(" ") : "—"} · {r.trigger.replace(/_/g, " ")} → {r.action}{(r.decision as { reason?: string } | null)?.reason ? ` (${(r.decision as { reason?: string }).reason})` : ""}</a><span className="text-faint">{ago(r.created_at)}</span></div>
                    {r.reply && <p className="mt-1 line-clamp-2 text-muted">{r.reply}</p>}
                  </li>
                );
              })}
            </ul>
          ) : <p className="mt-3 text-sm text-faint">No decisions yet.</p>}
        </Card>
        <Card className="p-5">
          <Label>What it knows (the only facts it may use)</Label>
          <pre className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-muted">{OFFER_FACTS}</pre>
        </Card>
      </div>
    </div>
  );
}
