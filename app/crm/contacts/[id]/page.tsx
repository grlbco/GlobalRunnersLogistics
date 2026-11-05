import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { clsx } from "clsx";
import { requireStaff } from "@/lib/crm/auth";
import { STAGES, TIERS } from "@/lib/crm/stages";
import { localTime } from "@/lib/crm/timezones";
import { ago, fullName, initials, phoneDisplay } from "@/lib/crm/format";
import { addNote, addTask, askAssistant, setAgentMode, setStage, toggleTask, updateContact } from "@/app/crm/actions";
import { getAssistantSettings } from "@/lib/crm/settings";
import { Card, Label, Skeleton, StageBadge, btnCls, btnGhostCls, inputCls } from "@/components/crm/ui";
import { Composer } from "@/components/crm/Composer";
import { Drafts } from "@/components/crm/Drafts";
import { Timeline, loadTimeline } from "@/components/crm/Timeline";

export default function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="p-8"><Skeleton className="h-[70vh]" /></div>}>
      <Profile params={params} />
    </Suspense>
  );
}

async function Profile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase } = await requireStaff(`/crm/contacts/${id}`);

  const [{ data: c }, items, memory, runs, followups, forms, tasks, assistant] = await Promise.all([
    supabase.from("contacts").select("*").eq("id", id).maybeSingle(),
    loadTimeline(supabase, id),
    supabase.from("agent_memory").select("*").eq("contact_id", id).maybeSingle(),
    supabase.from("agent_runs").select("trigger, action, decision, created_at").eq("contact_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("followups").select("due_at, reason, attempt").eq("contact_id", id).eq("status", "pending").order("due_at").limit(5),
    supabase.from("form_links").select("sent_at, opened_at, step_reached, completed_at").eq("contact_id", id).order("created_at", { ascending: false }).limit(1),
    supabase.from("tasks").select("id, title, due_at, done_at").eq("contact_id", id).order("done_at", { nullsFirst: true }).order("due_at", { nullsFirst: false }).limit(20),
    getAssistantSettings(),
  ]);
  if (!c) notFound();

  const form = forms.data?.[0];
  const hasEmailThread = items.some((m) => m.kind === "message" && m.channel === "email");
  const facts = (memory.data?.facts ?? {}) as Record<string, unknown>;

  return (
    <div className="grid min-h-dvh lg:grid-cols-[18rem_1fr_20rem]">
      {/* Left: identity */}
      <aside className="space-y-6 border-b border-white/[0.07] p-5 lg:border-b-0 lg:border-r">
        <Link href="/crm/contacts" className="text-xs text-white/45 hover:text-white">← Contacts</Link>
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-steel text-sm font-semibold">{initials(c)}</div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-[-0.02em]">{fullName(c)}</h1>
            <p className="truncate text-xs text-white/50">{c.company_name}</p>
          </div>
        </div>

        <form action={setStage} className="space-y-2">
          <input type="hidden" name="id" value={c.id} />
          <Label>Stage</Label>
          <div className="flex gap-2">
            <select name="stage" defaultValue={c.stage} className={inputCls}>
              {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <button className={btnGhostCls}>Move</button>
          </div>
        </form>

        <dl className="space-y-3 text-sm">
          {[
            ["Email", c.email],
            ["Phone", phoneDisplay(c.phone)],
            ["Cell", phoneDisplay(c.cell_phone)],
            ["Location", [c.city, c.state].filter(Boolean).join(", ")],
            ["Local time", localTime(c.timezone)],
            ["USDOT", c.usdot],
            ["Tier", c.tier ? `${c.tier} · ${TIERS[c.tier]}` : null],
            ["Officer 2", c.officer_2],
          ].map(([k, v]) => (
            <div key={k as string}>
              <dt className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-white/35">{k}</dt>
              <dd className="mt-0.5 break-words text-white/85">{v || "—"}</dd>
            </div>
          ))}
        </dl>

        <details className="group rounded-[6px] border border-white/[0.08]">
          <summary className="cursor-pointer list-none px-3 py-2 text-sm text-white/60 hover:text-white">Edit details</summary>
          <form action={updateContact} className="space-y-2 border-t border-white/[0.07] p-3">
            <input type="hidden" name="id" value={c.id} />
            <div className="grid grid-cols-2 gap-2">
              <input name="first_name" defaultValue={c.first_name ?? ""} placeholder="First name" className={inputCls} />
              <input name="last_name" defaultValue={c.last_name ?? ""} placeholder="Last name" className={inputCls} />
            </div>
            <input name="email" type="email" defaultValue={c.email ?? ""} placeholder="Email" className={inputCls} />
            <input name="cell_phone" defaultValue={c.cell_phone ?? ""} placeholder="Cell (+1…)" className={inputCls} />
            <div className="grid grid-cols-[1fr_4.5rem] gap-2">
              <input name="city" defaultValue={c.city ?? ""} placeholder="City" className={inputCls} />
              <input name="state" defaultValue={c.state ?? ""} placeholder="ST" maxLength={2} className={clsx(inputCls, "uppercase")} />
            </div>
            <button className={clsx(btnCls, "w-full")}>Save</button>
          </form>
        </details>

        <div className="space-y-2">
          <Label>Consent</Label>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className={clsx("rounded-full px-2 py-0.5", c.email_consent && !c.do_not_contact ? "bg-emerald-400/15 text-emerald-300" : "bg-white/[0.05] text-white/40")}>Email {c.email_consent && !c.do_not_contact ? "ok" : "off"}</span>
            <span className={clsx("rounded-full px-2 py-0.5", c.sms_consent && !c.do_not_contact ? "bg-emerald-400/15 text-emerald-300" : "bg-white/[0.05] text-white/40")}>Text {c.sms_consent && !c.do_not_contact ? "ok" : "no consent"}</span>
            {c.do_not_contact && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-red-300">Do not contact</span>}
            {(c.tags as string[]).map((t) => <span key={t} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-white/60">#{t}</span>)}
          </div>
        </div>
      </aside>

      {/* Center: conversation + timeline */}
      <section className="min-w-0 p-5 md:p-8">
        <div className="flex flex-wrap items-center gap-3"><StageBadge stage={c.stage} /><span className="text-xs text-white/40">since {ago(c.stage_changed_at)} ago</span></div>
        <div className="mt-6"><Drafts supabase={supabase} contactId={c.id} /></div>
        <div className="mt-4">
          <Composer
            contactId={c.id}
            sendingOn={process.env.SENDING_ENABLED === "true"}
            email={c.do_not_contact || !c.email_consent ? { ok: false, why: "Email is off for this driver" } : hasEmailThread ? { ok: true } : { ok: false, why: "No email thread yet: the first email comes from a campaign" }}
            sms={c.do_not_contact ? { ok: false, why: "Driver is do-not-contact" } : c.sms_consent ? { ok: true } : { ok: false, why: "No text consent yet: the driver must text us first or tick the form box" }}
          />
        </div>
        <form action={addNote} className="mt-4 flex gap-2">
          <input type="hidden" name="id" value={c.id} />
          <input name="body" required maxLength={5000} placeholder="Add a note…" className={inputCls} />
          <button className={btnGhostCls}>Save note</button>
        </form>
        <div className="mt-8"><Timeline items={items} /></div>
      </section>

      {/* Right: tasks + assistant */}
      <aside className="space-y-5 border-t border-white/[0.07] p-5 lg:border-l lg:border-t-0">
        <Card className="p-4">
          <Label>Tasks</Label>
          <form action={addTask} className="mt-3 space-y-2">
            <input type="hidden" name="contact_id" value={c.id} />
            <input name="title" required maxLength={300} placeholder="Call back, send form…" className={inputCls} />
            <div className="flex gap-2">
              <input name="due_at" type="datetime-local" className={clsx(inputCls, "[color-scheme:dark]")} />
              <button className={btnGhostCls}>Add</button>
            </div>
          </form>
          {tasks.data?.length ? (
            <ul className="mt-3 space-y-1.5 text-sm">
              {tasks.data.map((t) => (
                <li key={t.id}>
                  <form action={toggleTask} className="flex items-start gap-2">
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="contact_id" value={c.id} />
                    <button aria-label={t.done_at ? "Mark not done" : "Mark done"} className={clsx("mt-0.5 h-4 w-4 shrink-0 rounded-[3px] border", t.done_at ? "border-emerald-400 bg-emerald-400/30" : "border-white/30 hover:border-white")} />
                    <span className={clsx("flex-1", t.done_at && "text-white/35 line-through")}>{t.title}</span>
                    {t.due_at && !t.done_at && <span className={clsx("text-xs", new Date(t.due_at) < new Date() ? "text-red-300" : "text-white/40")}>{new Date(t.due_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>}
                  </form>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <Label>Assistant</Label>
            <span className={clsx("rounded-full px-2 py-0.5 text-[0.7rem]", c.agent_mode === "auto" ? "bg-emerald-400/15 text-emerald-300" : "bg-dusk/15 text-dusk")}>{c.agent_mode === "auto" ? "Auto" : "Manual"}</span>
          </div>
          {!assistant.enabled && (
            <p className="mt-3 rounded-[4px] border border-signal/30 bg-signal/[0.08] px-3 py-2 text-xs text-white/80">
              The assistant is off for everyone. <Link href="/crm/assistant" className="underline underline-offset-2">Turn it on</Link>
            </p>
          )}
          {assistant.enabled && assistant.draft_mode && <p className="mt-3 text-xs text-white/45">Draft mode: replies wait for your OK.</p>}
          <form action={askAssistant} className="mt-3">
            <input type="hidden" name="id" value={c.id} />
            <button disabled={!assistant.enabled || c.do_not_contact} className={clsx(btnCls, "w-full")}>Reply now</button>
          </form>
          <form action={setAgentMode} className="mt-2">
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="mode" value={c.agent_mode === "auto" ? "manual" : "auto"} />
            <button className={clsx(btnGhostCls, "w-full")}>{c.agent_mode === "auto" ? "Take over" : "Hand back to assistant"}</button>
          </form>
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <p className="text-xs text-white/40">Summary</p>
              <p className="mt-1 text-white/80">{memory.data?.summary ?? "Nothing yet. The assistant builds a summary after the first conversation."}</p>
            </div>
            {memory.data?.next_step && <div><p className="text-xs text-white/40">Next step</p><p className="mt-1 text-white/80">{memory.data.next_step}</p></div>}
            {Object.keys(facts).length > 0 && (
              <div>
                <p className="text-xs text-white/40">Known facts</p>
                <ul className="mt-1 space-y-1">{Object.entries(facts).map(([k, v]) => <li key={k} className="flex justify-between gap-3"><span className="text-white/50">{k.replace(/_/g, " ")}</span><span className="text-right text-white/85">{String(v)}</span></li>)}</ul>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <Label>Driver form</Label>
          <ol className="mt-3 space-y-1.5 text-sm">
            {[["Sent", form?.sent_at], ["Opened", form?.opened_at], ["Completed", form?.completed_at]].map(([k, v]) => (
              <li key={k as string} className="flex justify-between"><span className={v ? "text-white/85" : "text-white/35"}>{k}</span><span className="text-white/45">{v ? ago(v as string) : "—"}</span></li>
            ))}
          </ol>
          {form && !form.completed_at && form.step_reached > 0 && <p className="mt-2 text-xs text-dusk">Stopped at step {form.step_reached}</p>}
        </Card>

        <Card className="p-4">
          <Label>Upcoming follow-ups</Label>
          {followups.data?.length ? (
            <ul className="mt-3 space-y-2 text-sm">{followups.data.map((f, i) => <li key={i} className="flex justify-between gap-3"><span className="text-white/75">{f.reason ?? `Follow-up #${f.attempt}`}</span><span className="text-white/45">{new Date(f.due_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></li>)}</ul>
          ) : <p className="mt-3 text-sm text-white/40">None scheduled.</p>}
        </Card>

        <Card className="p-4">
          <Label>Assistant log</Label>
          {runs.data?.length ? (
            <ul className="mt-3 space-y-2 text-xs">{runs.data.map((r, i) => <li key={i} className="flex justify-between gap-3"><span className="text-white/70">{r.trigger.replace(/_/g, " ")} → {r.action}{(r.decision as { reason?: string } | null)?.reason ? <span className="text-white/40"> ({(r.decision as { reason?: string }).reason})</span> : null}</span><span className="text-white/40">{ago(r.created_at)}</span></li>)}</ul>
          ) : <p className="mt-3 text-sm text-white/40">No runs yet.</p>}
        </Card>
      </aside>
    </div>
  );
}
