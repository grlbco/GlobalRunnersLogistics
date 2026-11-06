import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { clsx } from "clsx";
import { requireStaff } from "@/lib/crm/auth";
import { isSendingOn } from "@/lib/crm/sending";
import { STAGES, TIERS, stageLabel } from "@/lib/crm/stages";
import { localTime } from "@/lib/crm/timezones";
import { ago, fullName, phoneDisplay } from "@/lib/crm/format";
import { addNote, addTask, askAssistant, setAgentMode, setStage, toggleTask, updateContact } from "@/app/crm/actions";
import { getAssistantSettings } from "@/lib/crm/settings";
import { Avatar, Badge, Card, Label, Skeleton, StageBadge, Stat, btnCls, btnGhostCls, inputCls, selectCls } from "@/components/crm/ui";
import { Stagger, StaggerItem } from "@/components/crm/motion";
import { duplicateReason } from "@/lib/agent/graduation";
import { outcomeOf } from "@/lib/crm/pipeline";
import { Composer } from "@/components/crm/Composer";
import { GiveAnswer } from "@/components/crm/GiveAnswer";
import { Drafts } from "@/components/crm/Drafts";
import { Timeline, answeringText, loadTimeline } from "@/components/crm/Timeline";

export default function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="px-5 md:px-6"><Skeleton className="h-[70vh]" /></div>}>
      <Profile params={params} />
    </Suspense>
  );
}

async function Profile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase } = await requireStaff(`/crm/contacts/${id}`, "contacts.view");

  const [{ data: c }, items, memory, runs, followups, forms, tasks, assistant, lastMove, formNote] = await Promise.all([
    supabase.from("contacts").select("*").eq("id", id).maybeSingle(),
    loadTimeline(supabase, id),
    supabase.from("agent_memory").select("*").eq("contact_id", id).maybeSingle(),
    supabase.from("agent_runs").select("trigger, action, decision, created_at").eq("contact_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("followups").select("due_at, reason, attempt").eq("contact_id", id).eq("status", "pending").order("due_at").limit(5),
    supabase.from("form_links").select("sent_at, opened_at, step_reached, completed_at").eq("contact_id", id).order("created_at", { ascending: false }).limit(1),
    supabase.from("tasks").select("id, title, due_at, done_at").eq("contact_id", id).order("done_at", { nullsFirst: true }).order("due_at", { nullsFirst: false }).limit(20),
    getAssistantSettings(),
    supabase.from("stage_events").select("from_stage, to_stage, actor_type, evidence_quote, decision").eq("contact_id", id).eq("decision", "applied").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("notes").select("body").eq("contact_id", id).eq("author_kind", "system").like("body", "Driver form completed%").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!c) notFound();

  const form = forms.data?.[0];
  const hasEmailThread = items.some((m) => m.kind === "message" && m.channel === "email");
  const facts = (memory.data?.facts ?? {}) as Record<string, unknown>;
  const phones = [c.cell_phone, c.phone].filter(Boolean) as string[];
  const [byPhone, byEmail] = await Promise.all([
    phones.length ? supabase.from("consents").select("created_at, page, consent_text, granted").in("phone", phones) : Promise.resolve({ data: [] }),
    c.email ? supabase.from("consents").select("created_at, page, consent_text, granted").eq("email", c.email) : Promise.resolve({ data: [] }),
  ]);
  const consentLog = [...(byPhone.data ?? []), ...(byEmail.data ?? [])].filter((x, i, all) => all.findIndex((y) => y.created_at === x.created_at) === i).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);
  // The list came from FMCSA carrier records: that describes a carrier, not a driver, until they tell us otherwise.
  const fromList = c.source === "toss_import";
  const cdlConfirmed = !!form?.completed_at || Object.keys(facts).some((k) => /cdl/i.test(k));
  const phoneMatch = phones.flatMap((x) => [`phone.eq.${x}`, `cell_phone.eq.${x}`]).join(",");
  const personCols = "id, first_name, last_name, phone, cell_phone, company_name, state";
  const [samePhone, sameName] = await Promise.all([
    phoneMatch ? supabase.from("contacts").select(personCols).or(phoneMatch).neq("id", c.id).limit(5) : Promise.resolve({ data: [] }),
    c.first_name && c.last_name && c.state ? supabase.from("contacts").select(personCols).ilike("first_name", c.first_name).ilike("last_name", c.last_name).eq("state", c.state).neq("id", c.id).limit(5) : Promise.resolve({ data: [] }),
  ]);
  const duplicates = [...(samePhone.data ?? []), ...(sameName.data ?? [])]
    .filter((x, i, all) => all.findIndex((y) => y.id === x.id) === i)
    .map((x) => ({ ...x, why: duplicateReason(c, x) }))
    .filter((x) => x.why);
  const outcome = outcomeOf({ stage: c.stage, doNotContact: c.do_not_contact, agentMode: c.agent_mode, formCompleted: !!form?.completed_at, lastInboundAt: c.last_inbound_at, lastOutboundAt: c.last_outbound_at, now: new Date() });
  const waitingOnKen = ["applied", "qualified", "sent_to_ken"].includes(c.stage);
  const call = c.cell_phone ?? c.phone;

  return (
    <div className="space-y-3 px-5 md:px-6">
      <div className="pt-1">
        <Link href="/crm/contacts" className="text-[0.84rem] text-muted transition-colors hover:text-fg">Contacts</Link>
        <h1 className="mt-1 text-[1.5rem] font-medium leading-tight tracking-[-0.025em]">Driver overview</h1>
      </div>
      <Card className="flex flex-wrap items-center gap-4 p-4">
        <Avatar name={fullName(c)} className="h-14 w-14 rounded-[16px] text-base" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[1.1rem] font-medium tracking-[-0.015em]">{fullName(c)}</p>
          <p className="truncate text-[0.84rem] text-muted">{[c.company_name, c.email, phoneDisplay(c.cell_phone ?? c.phone), [c.city, c.state].filter(Boolean).join(", ")].filter(Boolean).join("  ·  ")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StageBadge stage={c.stage} />
          {outcome !== "In progress" && <Badge tone={outcome === "Form completed" || outcome === "Hired" ? "good" : outcome === "Went quiet" || outcome === "Handed off" ? "warn" : "neutral"}>{outcome}</Badge>}
          <Badge dot tone={c.agent_mode === "auto" ? "info" : "warn"}>{c.agent_mode === "auto" ? "Assistant on" : "Manual"}</Badge>
          {!cdlConfirmed && fromList && <Badge tone="warn">Carrier record, CDL not confirmed</Badge>}
        </div>
        {(memory.data?.summary || memory.data?.next_step) && (
          <div className="w-full border-t border-line pt-3 text-[0.875rem] leading-relaxed">
            {memory.data?.summary && <p className="text-fg-2">{memory.data.summary}</p>}
            {memory.data?.next_step && <p className="mt-0.5 text-muted">Next: {memory.data.next_step}</p>}
            <p className="mt-1 text-[0.72rem] text-faint">Written by the assistant</p>
          </div>
        )}
      </Card>
      {waitingOnKen && (
        <Card className="flex flex-wrap items-start justify-between gap-4 p-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-[0.95rem] font-medium tracking-[-0.01em]">Before you call</h2>
            <p className="mt-1 whitespace-pre-wrap text-[0.875rem] leading-relaxed text-fg-2">{formNote.data?.body.replace(/^Driver form completed\.\n?/, "") || memory.data?.summary || "No form answers on file."}</p>
          </div>
          {call && <a href={`tel:${call}`} className={btnCls}>Call {phoneDisplay(call)}</a>}
        </Card>
      )}
      <Stagger className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StaggerItem><Stat label="Messages" value={items.filter((m) => m.kind === "message").length} hint={`${items.filter((m) => m.kind === "message" && m.direction === "inbound").length} from the driver`} /></StaggerItem>
        <StaggerItem><Stat label="Last reply" value={c.last_inbound_at ? ago(c.last_inbound_at) : "None"} hint={c.last_inbound_at ? "ago" : "Hasn't written back yet"} /></StaggerItem>
        <StaggerItem><Stat label="Driver form" value={form?.completed_at ? "Done" : form?.opened_at ? "Opened" : form?.sent_at ? "Sent" : "Not sent"} hint={form && !form.completed_at && form.step_reached > 0 ? `Stopped at step ${form.step_reached}` : followups.data?.length ? `${followups.data.length} follow-ups scheduled` : "No follow-ups scheduled"} /></StaggerItem>
        <StaggerItem><Stat label="Open tasks" value={(tasks.data ?? []).filter((t) => !t.done_at).length} hint={`In this stage for ${ago(c.stage_changed_at)}`} /></StaggerItem>
      </Stagger>
      <div className="grid items-start gap-3 lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)_20rem]">
      {/* Left: identity */}
      <aside className="space-y-6 rounded-[16px] border border-line bg-surface p-5 shadow-card">
        <form action={setStage} className="space-y-2">
          <input type="hidden" name="id" value={c.id} />
          <Label>Stage</Label>
          <div className="flex gap-2">
            <select key={c.stage} name="stage" defaultValue={c.stage} className={selectCls}>
              {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <button className={btnGhostCls}>Move</button>
          </div>
          <p className="text-[0.75rem] text-faint">Moving a card by hand takes over from the assistant.</p>
        </form>

        {c.stage_locked_at && <p className="rounded-[12px] border border-line bg-subtle px-3 py-2 text-[0.8rem] text-muted">Moved by a person, so the assistant can&apos;t change this stage until you hand back.</p>}

        {!c.stage_locked_at && lastMove.data?.actor_type === "ai" && lastMove.data.to_stage === c.stage && (
          <form action={setStage} className="rounded-[12px] border border-line bg-subtle px-3 py-2 text-[0.8rem] text-muted">
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="stage" value={lastMove.data.from_stage ?? ""} />
            <p>Moved by the assistant{lastMove.data.evidence_quote ? <>: &ldquo;{lastMove.data.evidence_quote}&rdquo;</> : "."}</p>
            <button className="mt-1 font-medium text-fg underline-offset-4 hover:underline">Move back to {stageLabel(lastMove.data.from_stage ?? "")}</button>
          </form>
        )}

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
              <dt className="text-[0.72rem] text-faint">{k}{fromList && v && ["Email", "Phone", "Location", "USDOT", "Officer 2"].includes(k as string) ? " · FMCSA record" : ""}</dt>
              <dd className="mt-0.5 break-words text-[0.875rem] text-fg">{v || <span className="text-ghost">—</span>}</dd>
            </div>
          ))}
        </dl>

        {duplicates.length > 0 && (
          <div className="rounded-[12px] border border-line bg-subtle px-3 py-2 text-[0.8rem]">
            <p className="font-medium text-fg-2">Might be the same driver</p>
            <ul className="mt-1 space-y-1">{duplicates.map((x) => <li key={x.id}><Link href={`/crm/contacts/${x.id}`} className="text-fg underline-offset-4 hover:underline">{fullName(x)}</Link> <span className="text-faint">· {x.why}</span></li>)}</ul>
            <p className="mt-1 text-[0.72rem] text-faint">Not merged: a phone can be shared by several drivers.</p>
          </div>
        )}

        <details className="group rounded-[14px] border border-line bg-surface shadow-card">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[0.84rem] font-medium text-fg-2 hover:text-fg">Edit details<span className="text-faint transition-transform group-open:rotate-180">⌄</span></summary>
          <form action={updateContact} className="space-y-2 border-t border-line p-3">
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
            <Badge dot tone={c.email_consent && !c.do_not_contact ? "good" : "neutral"}>Email {c.email_consent && !c.do_not_contact ? "ok" : "off"}</Badge>
            <Badge dot tone={c.sms_consent && !c.do_not_contact ? "good" : "neutral"}>Text {c.sms_consent && !c.do_not_contact ? "ok" : "no consent"}</Badge>
            {c.do_not_contact && <Badge dot tone="bad">Do not contact</Badge>}
            {(c.tags as string[]).map((t) => <Badge key={t}>#{t}</Badge>)}
          </div>
          {consentLog.length > 0 && (
            <ul className="space-y-2 pt-1 text-[0.78rem]">
              {consentLog.map((x) => (
                <li key={x.created_at}>
                  <span className={x.granted ? "font-medium text-emerald-700" : "font-medium text-red-600"}>{x.granted ? "Agreed" : "Opted out"}</span>
                  <span className="text-faint"> · {x.page ?? "website form"} · {new Date(x.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  <span className="mt-0.5 block truncate text-muted" title={x.consent_text}>&ldquo;{x.consent_text}&rdquo;</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Center: conversation + timeline */}
      <section className="min-w-0 space-y-3">
        <Drafts supabase={supabase} contactId={c.id} />
        <GiveAnswer contactId={c.id} />
        <div>
          <Composer
            contactId={c.id}
            sendingOn={await isSendingOn()}
            email={c.do_not_contact || !c.email_consent ? { ok: false, why: "Email is off for this driver" } : hasEmailThread ? { ok: true } : { ok: false, why: "No email thread yet: the first email comes from a campaign" }}
            sms={c.do_not_contact ? { ok: false, why: "Driver is do-not-contact" } : c.sms_consent || answeringText(items) ? { ok: true } : { ok: false, why: "No text consent yet: the driver must text us first or tick the form box" }}
          />
        </div>
        <form action={addNote} className="flex gap-2">
          <input type="hidden" name="id" value={c.id} />
          <input name="body" required maxLength={5000} placeholder="Add a note…" className={inputCls} />
          <button className={btnGhostCls}>Save note</button>
        </form>
        <Card className="p-4 md:p-5"><Timeline items={items} /></Card>
      </section>

      {/* Right: tasks + assistant */}
      <aside className="space-y-3 lg:col-span-2 xl:col-span-1">
        <Card className="p-4">
          <Label>Tasks</Label>
          <form action={addTask} className="mt-3 space-y-2">
            <input type="hidden" name="contact_id" value={c.id} />
            <input name="title" required maxLength={300} placeholder="Call back, send form…" className={inputCls} />
            <div className="flex gap-2">
              <input name="due_at" type="datetime-local" className={inputCls} />
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
                    <button aria-label={t.done_at ? "Mark not done" : "Mark done"} className={clsx("mt-0.5 h-4 w-4 shrink-0 rounded-[3px] border", t.done_at ? "border-emerald-400 bg-emerald-50" : "border-line-strong hover:border-fg")} />
                    <span className={clsx("flex-1", t.done_at && "text-ghost line-through")}>{t.title}</span>
                    {t.due_at && !t.done_at && <span className={clsx("text-xs", new Date(t.due_at) < new Date() ? "text-red-600" : "text-faint")}>{new Date(t.due_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>}
                  </form>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <Label>Assistant</Label>
            <Badge dot tone={c.agent_mode === "auto" ? "good" : "warn"}>{c.agent_mode === "auto" ? "Auto" : "Manual"}</Badge>
          </div>
          {!assistant.enabled && (
            <p className="mt-3 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              The assistant is off for everyone. <Link href="/crm/assistant" className="underline underline-offset-2">Turn it on</Link>
            </p>
          )}
          {assistant.enabled && assistant.draft_mode && <p className="mt-3 text-xs text-faint">Draft mode: replies wait for your OK.</p>}
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
              <p className="text-xs text-faint">Summary</p>
              <p className="mt-1 text-fg-2">{memory.data?.summary ?? "Nothing yet. The assistant builds a summary after the first conversation."}</p>
            </div>
            {memory.data?.next_step && <div><p className="text-xs text-faint">Next step</p><p className="mt-1 text-fg-2">{memory.data.next_step}</p></div>}
            {Object.keys(facts).length > 0 && (
              <div>
                <p className="text-xs text-faint">What the driver said, noted by the assistant</p>
                <ul className="mt-1 space-y-1">{Object.entries(facts).map(([k, v]) => <li key={k} className="flex justify-between gap-3"><span className="text-faint">{k.replace(/_/g, " ")}</span><span className="text-right text-fg-2">{String(v)}</span></li>)}</ul>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <Label>Driver form</Label>
          <ol className="relative mt-3 space-y-3 text-sm before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-line">
            {[["Sent", form?.sent_at], ["Opened", form?.opened_at], ["Completed", form?.completed_at]].map(([k, v]) => (
              <li key={k as string} className="relative flex items-center justify-between pl-6">
                <span className={clsx("absolute left-0 h-[11px] w-[11px] rounded-full border-2", v ? (k === "Completed" ? "border-emerald-500 bg-emerald-500" : "border-fg bg-fg") : "border-line-strong bg-surface")} />
                <span className={v ? "text-fg" : "text-faint"}>{k}</span><span className="text-[0.75rem] text-faint">{v ? ago(v as string) : "—"}</span>
              </li>
            ))}
          </ol>
          {form && !form.completed_at && form.step_reached > 0 && <p className="mt-3 text-xs font-medium text-amber-800">Stopped at step {form.step_reached}</p>}
        </Card>

        <Card className="p-4">
          <Label>Upcoming follow-ups</Label>
          {followups.data?.length ? (
            <ul className="mt-3 space-y-2 text-sm">{followups.data.map((f, i) => <li key={i} className="flex justify-between gap-3"><span className="text-fg-2">{f.reason ?? `Follow-up #${f.attempt}`}</span><span className="text-faint">{new Date(f.due_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></li>)}</ul>
          ) : <p className="mt-3 text-sm text-faint">None scheduled.</p>}
        </Card>

        <Card className="p-4">
          <Label>Assistant log</Label>
          {runs.data?.length ? (
            <ul className="mt-3 space-y-2 text-xs">{runs.data.map((r, i) => <li key={i} className="flex justify-between gap-3"><span className="text-muted">{r.trigger.replace(/_/g, " ")} → {r.action}{(r.decision as { reason?: string } | null)?.reason ? <span className="text-faint"> ({(r.decision as { reason?: string }).reason})</span> : null}</span><span className="text-faint">{ago(r.created_at)}</span></li>)}</ul>
          ) : <p className="mt-3 text-sm text-faint">No runs yet.</p>}
        </Card>
      </aside>
      </div>
    </div>
  );
}
