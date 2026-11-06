import { Suspense } from "react";
import { requireStaff } from "@/lib/crm/auth";
import { getAssistantSettings, getAutoGroups, getFactsApproval } from "@/lib/crm/settings";
import { OFFER_FACTS } from "@/lib/agent/knowledge";
import { FIXED_ANSWERS } from "@/lib/agent/fixed";
import { GRADUATE_AT, RISK_GROUPS, reviewProgress } from "@/lib/agent/graduation";
import { factsVersion } from "@/lib/agent/versions";
import { approveFacts, reviewReply, saveAssistantSettings, setAssistantEnabled, setAutoSend } from "@/app/crm/actions";
import { clsx } from "clsx";
import { LiveDot } from "@/components/crm/motion";
import { btnAccentCls, btnCls, btnDangerCls, btnGhostCls, Card, inputCls, Label, PageHead, Skeleton } from "@/components/crm/ui";
import { AssistantTest } from "@/components/crm/AssistantTest";
import { ago, n, reviewsFrom } from "@/lib/crm/format";

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
  const [{ data: runs }, { data: today }, { data: approvals }, { data: reviewRows }, approval, autoGroups, { data: sentByAi }, { data: checked }] = await Promise.all([
    supabase.from("agent_runs").select("trigger, action, reply, decision, cost_usd, created_at, contact:contacts(id, first_name, last_name)").order("created_at", { ascending: false }).limit(15),
    supabase.from("agent_runs").select("action, cost_usd").gte("created_at", since),
    supabase.from("activities").select("data").eq("type", "draft_approved").limit(5000),
    supabase.from("activities").select("type, data").in("type", ["draft_approved", "draft_discarded"]).limit(5000),
    getFactsApproval(),
    getAutoGroups(),
    supabase.from("messages").select("id, contact_id, channel, body, created_at").eq("author", "agent").eq("direction", "outbound").order("created_at", { ascending: false }).limit(40),
    supabase.from("activities").select("data").eq("type", "reply_review").order("created_at", { ascending: false }).limit(500),
  ]);
  const checkedIds = new Set((checked ?? []).map((x) => (x.data as { message_id?: string }).message_id));
  const toCheck = (sentByAi ?? []).filter((m) => !checkedIds.has(m.id)).slice(0, 4);
  const factsOk = approval?.version === factsVersion();
  const reviews = reviewsFrom(reviewRows ?? []);
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
              ? s.draft_mode ? autoGroups.length ? "It writes drafts for you to approve, except the kinds of message you switched to auto-send." : "It writes replies as drafts; you approve each one." : "It replies 24/7 within minutes. Follow-up texts it starts itself go out 9am–8pm driver time, Sunday from noon."
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
              <span>Draft mode<span className="block text-xs text-faint">You approve every message before it sends, except the kinds switched to auto-send below</span></span>
              <input type="checkbox" name="draft_mode" defaultChecked={s.draft_mode} disabled={!admin} className="h-5 w-5 accent-[#e8401c]" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1"><span className="text-xs text-faint">Reply delay from (min)</span><input name="delay_min_m" type="number" defaultValue={Math.round(s.delay_min_s / 60)} className={inputCls} disabled={!admin} /></label>
              <label className="space-y-1"><span className="text-xs text-faint">to (min)</span><input name="delay_max_m" type="number" defaultValue={Math.round(s.delay_max_s / 60)} className={inputCls} disabled={!admin} /></label>
              <label className="space-y-1"><span className="text-xs text-faint">Max messages / driver / day</span><input name="max_per_day" type="number" defaultValue={s.max_per_day} className={inputCls} disabled={!admin} /></label>
              <label className="space-y-1"><span className="text-xs text-faint">Max follow-ups</span><input name="max_followups" type="number" defaultValue={s.max_followups} className={inputCls} disabled={!admin} /></label>
            </div>
            <p className="text-xs text-faint">Replies to drivers go out 24/7. Follow-up texts the assistant or an automation starts wait for 9am–8pm in the driver&apos;s time zone, Sunday from noon, at most 3 in 24 hours. Email has no time limit. STOP and opt-outs are handled in code first.</p>
            {admin && <button className={btnCls}>Save</button>}
          </form>
        </Card>
        <Card className="p-5">
          <Label>Auto-send, earned by kind of message</Label>
          <p className="mt-1 text-xs leading-relaxed text-faint">A kind is ready after {GRADUATE_AT} approved drafts with at most 1 in 10 edited or discarded. That target is a starting suggestion. You still switch each one on.</p>
          {!factsOk && <p className="mt-3 rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Nothing can auto-send until the facts sheet is approved.</p>}
          <ul className="mt-3 divide-y divide-line text-sm">
            {RISK_GROUPS.map((g) => {
              const p = reviewProgress(g.key, reviews);
              const on = autoGroups.includes(g.key);
              return (
                <li key={g.key} className="flex items-center justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="block font-medium">{g.label}</span>
                    <span className="block text-xs text-faint">{g.key === "fixed" ? g.hint : `${n(p.clean)} of ${GRADUATE_AT} clean · ${n(p.changed)} changed`}</span>
                  </span>
                  {admin && (on || (p.ready && factsOk)) ? (
                    <form action={setAutoSend}>
                      <input type="hidden" name="group" value={g.key} />
                      <input type="hidden" name="on" value={on ? "0" : "1"} />
                      <button className={btnGhostCls}>{on ? "Back to drafts" : "Auto-send"}</button>
                    </form>
                  ) : <span className="shrink-0 text-xs text-faint">{on ? "Auto-send" : "Drafts"}</span>}
                </li>
              );
            })}
          </ul>
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
        {admin && toCheck.length > 0 && (
          <Card className="p-5">
            <Label>Check a few real replies</Label>
            <p className="mt-1 text-xs leading-relaxed text-faint">Do a few each week, including ones that look fine. It&apos;s how mistakes nobody complained about get found. The count shows in Reports.</p>
            <ul className="mt-3 divide-y divide-line text-sm">
              {toCheck.map((m) => (
                <li key={m.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <a href={`/crm/contacts/${m.contact_id}`} className="min-w-0 flex-1 text-fg-2 hover:text-fg"><span className="line-clamp-3 whitespace-pre-wrap">{m.body}</span><span className="mt-0.5 block text-xs text-faint">{m.channel === "sms" ? "Text" : "Email"} · {ago(m.created_at)}</span></a>
                  <form action={reviewReply} className="flex shrink-0 gap-1.5">
                    <input type="hidden" name="message_id" value={m.id} />
                    <input type="hidden" name="contact_id" value={m.contact_id} />
                    <button name="ok" value="1" className={btnGhostCls}>Correct</button>
                    <button name="ok" value="0" className={btnDangerCls}>Wrong</button>
                  </form>
                </li>
              ))}
            </ul>
          </Card>
        )}
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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Label>Facts sheet (the only facts it may use)</Label>
              <p className={clsx("mt-1 text-xs", factsOk ? "text-emerald-700" : "text-amber-800")}>
                {factsOk && approval ? `Approved by ${approval.by}, ${new Date(approval.at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : approval ? "The facts changed since they were approved. Ken needs to check them again." : "Not approved yet. Ken needs to check these."}
              </p>
            </div>
            {admin && !factsOk && <form action={approveFacts}><button className={btnCls}>Approve these facts</button></form>}
          </div>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-xs leading-relaxed text-muted">{OFFER_FACTS}</pre>
          <p className="mt-4 text-[0.8rem] font-medium text-muted">Set answers it gives word for word</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted">{FIXED_ANSWERS.map((t) => <li key={t}>{t}</li>)}</ul>
        </Card>
      </div>
    </div>
  );
}
