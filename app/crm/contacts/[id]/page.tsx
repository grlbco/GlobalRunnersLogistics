import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { clsx } from "clsx";
import { requireStaff } from "@/lib/crm/auth";
import { STAGES, TIERS, stageLabel } from "@/lib/crm/stages";
import { localTime } from "@/lib/crm/timezones";
import { ago, fullName, initials, phoneDisplay } from "@/lib/crm/format";
import { addNote, setAgentMode, setStage } from "@/app/crm/actions";
import { Card, Label, Skeleton, StageBadge, btnCls, btnGhostCls, inputCls } from "@/components/crm/ui";

export default function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="p-8"><Skeleton className="h-[70vh]" /></div>}>
      <Profile params={params} />
    </Suspense>
  );
}

type Item =
  | { kind: "message"; at: string; channel: string; direction: string; author: string; subject: string | null; body: string; status: string }
  | { kind: "activity"; at: string; type: string; data: Record<string, unknown>; actor: string }
  | { kind: "note"; at: string; body: string; author_kind: string };

async function Profile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase } = await requireStaff(`/crm/contacts/${id}`);

  const [{ data: c }, msgs, acts, notes, memory, runs, followups, forms] = await Promise.all([
    supabase.from("contacts").select("*").eq("id", id).maybeSingle(),
    supabase.from("messages").select("channel, direction, author, subject, body, status, created_at").eq("contact_id", id).order("created_at", { ascending: false }).limit(200),
    supabase.from("activities").select("type, data, actor, created_at").eq("contact_id", id).order("created_at", { ascending: false }).limit(200),
    supabase.from("notes").select("body, author_kind, created_at").eq("contact_id", id).order("created_at", { ascending: false }).limit(100),
    supabase.from("agent_memory").select("*").eq("contact_id", id).maybeSingle(),
    supabase.from("agent_runs").select("trigger, action, reply, created_at").eq("contact_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("followups").select("due_at, channel, reason, attempt").eq("contact_id", id).eq("status", "pending").order("due_at").limit(5),
    supabase.from("form_links").select("sent_at, opened_at, step_reached, completed_at").eq("contact_id", id).order("created_at", { ascending: false }).limit(1),
  ]);
  if (!c) notFound();

  const items: Item[] = [
    ...(msgs.data ?? []).map((m) => ({ kind: "message" as const, at: m.created_at, ...m })),
    ...(acts.data ?? []).map((a) => ({ kind: "activity" as const, at: a.created_at, type: a.type, data: a.data, actor: a.actor })),
    ...(notes.data ?? []).map((nt) => ({ kind: "note" as const, at: nt.created_at, body: nt.body, author_kind: nt.author_kind })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const form = forms.data?.[0];
  const facts = (memory.data?.facts ?? {}) as Record<string, unknown>;
  const local = localTime(c.timezone);

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
            ["Local time", local],
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

        <div className="space-y-2">
          <Label>Consent</Label>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className={clsx("rounded-full px-2 py-0.5", c.email_consent && !c.do_not_contact ? "bg-emerald-400/15 text-emerald-300" : "bg-white/[0.05] text-white/40")}>Email {c.email_consent && !c.do_not_contact ? "ok" : "off"}</span>
            <span className={clsx("rounded-full px-2 py-0.5", c.sms_consent && !c.do_not_contact ? "bg-emerald-400/15 text-emerald-300" : "bg-white/[0.05] text-white/40")}>Text {c.sms_consent && !c.do_not_contact ? "ok" : "no consent"}</span>
            {c.do_not_contact && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-red-300">Do not contact</span>}
          </div>
        </div>
      </aside>

      {/* Center: timeline */}
      <section className="min-w-0 p-5 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><StageBadge stage={c.stage} /><span className="text-xs text-white/40">since {ago(c.stage_changed_at)} ago</span></div>
          <div className="flex gap-2">
            <button disabled title="Available once sending is turned on" className={clsx(btnGhostCls, "opacity-40")}>Email</button>
            <button disabled title="Available once texting is approved" className={clsx(btnGhostCls, "opacity-40")}>Text</button>
          </div>
        </div>

        <form action={addNote} className="mt-6 flex gap-2">
          <input type="hidden" name="id" value={c.id} />
          <input name="body" required maxLength={5000} placeholder="Add a note…" className={inputCls} />
          <button className={btnCls}>Save</button>
        </form>

        <ol className="mt-8 space-y-4">
          {items.length === 0 && <li className="rounded-[6px] border border-dashed border-white/10 p-10 text-center text-sm text-white/45">No activity yet. Emails, texts, calls, form steps and notes will appear here.</li>}
          {items.map((it, i) => <TimelineItem key={i} it={it} />)}
        </ol>
      </section>

      {/* Right: assistant */}
      <aside className="space-y-5 border-t border-white/[0.07] p-5 lg:border-l lg:border-t-0">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <Label>Assistant</Label>
            <span className={clsx("rounded-full px-2 py-0.5 text-[0.7rem]", c.agent_mode === "auto" ? "bg-emerald-400/15 text-emerald-300" : "bg-dusk/15 text-dusk")}>{c.agent_mode === "auto" ? "Auto" : "Manual"}</span>
          </div>
          <form action={setAgentMode} className="mt-3">
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
            <ul className="mt-3 space-y-2 text-xs">{runs.data.map((r, i) => <li key={i} className="flex justify-between gap-3"><span className="text-white/70">{r.trigger} → {r.action}</span><span className="text-white/40">{ago(r.created_at)}</span></li>)}</ul>
          ) : <p className="mt-3 text-sm text-white/40">No runs yet.</p>}
        </Card>
      </aside>
    </div>
  );
}

function TimelineItem({ it }: { it: Item }) {
  const time = <time className="text-[0.7rem] text-white/35">{new Date(it.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time>;
  if (it.kind === "message") {
    const inbound = it.direction === "inbound";
    const who = inbound ? "Driver" : it.author === "agent" ? "Assistant" : it.author === "campaign" ? "Campaign" : it.author === "human" ? "You" : "System";
    return (
      <li className={clsx("max-w-[42rem]", !inbound && "ml-auto")}>
        <div className={clsx("rounded-[8px] border p-4", inbound ? "border-white/10 bg-white/[0.03]" : "border-signal/25 bg-signal/[0.06]")}>
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="font-medium text-white/80">{who} · {it.channel === "sms" ? "Text" : it.channel === "call" ? "Call" : "Email"}{it.status === "draft" ? " · draft" : ""}</span>
            {time}
          </div>
          {it.subject && <p className="mt-2 text-sm font-medium">{it.subject}</p>}
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-white/80">{it.body}</p>
        </div>
      </li>
    );
  }
  if (it.kind === "note") {
    return (
      <li className="rounded-[6px] border border-dusk/20 bg-dusk/[0.05] p-3">
        <div className="flex justify-between text-xs"><span className="text-dusk">Note{it.author_kind !== "human" ? ` · ${it.author_kind}` : ""}</span>{time}</div>
        <p className="mt-1 whitespace-pre-wrap text-sm text-white/80">{it.body}</p>
      </li>
    );
  }
  const d = it.data as { from?: string; to?: string };
  const text =
    it.type === "stage_changed" ? `Moved from ${stageLabel(d.from ?? "")} to ${stageLabel(d.to ?? "")}` :
    it.type === "taken_over" ? "Taken over by a person" :
    it.type === "assistant_resumed" ? "Handed back to the assistant" :
    it.type.replace(/_/g, " ");
  return (
    <li className="flex items-center justify-between gap-4 px-1 text-xs text-white/45">
      <span>{text}{it.actor.startsWith("user:") ? "" : ` · ${it.actor}`}</span>
      {time}
    </li>
  );
}
