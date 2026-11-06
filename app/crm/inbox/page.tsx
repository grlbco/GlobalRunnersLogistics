import Link from "next/link";
import { Suspense } from "react";
import { clsx } from "clsx";
import { requireStaff } from "@/lib/crm/auth";
import { isSendingOn } from "@/lib/crm/sending";
import { ago, fullName, phoneDisplay } from "@/lib/crm/format";
import { localTime } from "@/lib/crm/timezones";
import { Avatar, Badge, Card, Empty, Label, Skeleton, StageBadge } from "@/components/crm/ui";
import { TIERS } from "@/lib/crm/stages";
import { Composer } from "@/components/crm/Composer";
import { Drafts } from "@/components/crm/Drafts";
import { Timeline, answeringText, loadTimeline } from "@/components/crm/Timeline";
import { MarkRead } from "@/components/crm/MarkRead";
import { GiveAnswer } from "@/components/crm/GiveAnswer";
import { setAgentMode } from "@/app/crm/actions";

export const metadata = { title: "Inbox" };

type SP = Promise<{ c?: string; f?: string }>;
const FILTERS = [
  { key: "needs", label: "Needs you" },
  { key: "assistant", label: "Assistant handling" },
  { key: "call", label: "Form done: call driver" },
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
] as const;

export default function InboxPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<div className="px-5 md:px-6"><Skeleton className="h-[80vh]" /></div>}>
      <Inbox searchParams={searchParams} />
    </Suspense>
  );
}

/** The form is done, so the next move is Ken's call. */
const CALL_STAGES = new Set(["applied", "qualified", "sent_to_ken"]);

type Contact = { id: string; first_name: string | null; last_name: string | null; company_name: string | null; stage: string; agent_mode: string; cell_phone: string | null; phone: string | null; email: string | null; timezone: string | null; do_not_contact: boolean; email_consent: boolean; sms_consent: boolean; tier: number | null; city: string | null; state: string | null; last_inbound_at: string | null };

async function Inbox({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const f = FILTERS.some((x) => x.key === sp.f) ? sp.f! : "needs";
  const { supabase } = await requireStaff("/crm/inbox", "inbox.view");

  const q = supabase
    .from("messages")
    .select("id, channel, direction, author, body, created_at, contact:contacts(id, first_name, last_name, company_name, stage, agent_mode, cell_phone, phone, email, timezone, do_not_contact, email_consent, sms_consent, tier, city, state, last_inbound_at)")
    .neq("channel", "call")
    .order("created_at", { ascending: false })
    .limit(500);
  // Needs you: an open task, a draft waiting for approval, or a message that failed to send.
  const [{ data }, { data: unreadRows }, { data: openTasks }, { data: waitingSends }] = await Promise.all([
    q,
    supabase.from("conversations").select("contact_id").eq("unread", true),
    supabase.from("tasks").select("contact_id, title").is("done_at", null).not("contact_id", "is", null).order("created_at"),
    supabase.from("outbox").select("contact_id, status").in("status", ["draft", "failed"]),
  ]);
  // Why each driver needs someone. A task says it best, then a failed send, then a draft.
  const why = new Map<string, string>();
  for (const o of waitingSends ?? []) if (o.status === "draft") why.set(o.contact_id, "Draft to approve");
  for (const o of waitingSends ?? []) if (o.status === "failed") why.set(o.contact_id, "A message failed to send");
  for (const t of openTasks ?? []) why.set(t.contact_id as string, t.title as string);
  const needsYou = new Set(why.keys());
  const unreadSet = new Set((unreadRows ?? []).map((r) => r.contact_id as string));

  const seen = new Set<string>();
  let threads = (data ?? []).filter((m) => {
    const c = m.contact as unknown as Contact | null;
    if (!c || seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
  if (f === "needs") threads = threads.filter((m) => needsYou.has((m.contact as unknown as Contact).id)).reverse(); // longest wait first
  if (f === "assistant") threads = threads.filter((m) => { const c = m.contact as unknown as Contact; return c.agent_mode === "auto" && !c.do_not_contact && !needsYou.has(c.id) && !CALL_STAGES.has(c.stage); });
  if (f === "call") threads = threads.filter((m) => CALL_STAGES.has((m.contact as unknown as Contact).stage));
  if (f === "unread") threads = threads.filter((m) => unreadSet.has((m.contact as unknown as Contact).id));
  if (f === "reply") threads = threads.filter((m) => m.direction === "inbound");

  const selectedId = sp.c ?? (threads[0]?.contact as unknown as Contact | undefined)?.id;
  const selected = (threads.find((m) => (m.contact as unknown as Contact).id === selectedId)?.contact ?? null) as unknown as Contact | null;
  const href = (patch: { c?: string; f?: string }) => {
    const p = new URLSearchParams();
    const nf = patch.f ?? f;
    if (nf !== "needs") p.set("f", nf);
    const nc = patch.c ?? (patch.f ? undefined : selectedId);
    if (nc) p.set("c", nc);
    return `/crm/inbox${p.size ? `?${p}` : ""}`;
  };

  return (
    <div className="grid h-[calc(100dvh-11.5rem)] gap-3 px-5 md:h-[calc(100dvh-6.25rem)] md:grid-cols-[20rem_1fr] md:px-6 xl:grid-cols-[20rem_1fr_18rem]">
      {/* List */}
      <section className={clsx("flex min-h-0 flex-col rounded-[16px] border border-line bg-surface shadow-card", sp.c && "hidden md:flex")}>
        <header className="px-4 pb-3 pt-4">
          <div className="flex items-baseline justify-between">
            <h1 className="text-[1.05rem] font-medium tracking-[-0.015em]">Conversations</h1>
            {unreadSet.size > 0 && <span className="text-[0.78rem] font-medium text-red-600">{unreadSet.size} unread</span>}
          </div>
          <nav className="mt-3 flex flex-wrap gap-1">
            {FILTERS.map((x) => (
              <Link key={x.key} href={href({ f: x.key })} className={clsx("rounded-[10px] border px-2.5 py-1.5 text-[0.78rem] font-medium transition-colors duration-150", f === x.key ? "border-fg bg-fg text-surface" : "border-line text-muted hover:text-fg")}>
                {x.label}{x.key === "needs" && needsYou.size > 0 ? ` ${needsYou.size}` : ""}
              </Link>
            ))}
          </nav>
        </header>
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2 pt-0">
          {threads.map((m) => {
            const c = m.contact as unknown as Contact;
            const unread = unreadSet.has(c.id);
            return (
              <li key={m.id}>
                <Link href={href({ c: c.id })} className={clsx("flex gap-3 rounded-[14px] border px-3 py-3 transition-colors duration-150", c.id === selectedId ? "border-line-strong bg-subtle" : "border-transparent hover:bg-hover")}>
                  <span className="relative">
                    <Avatar name={fullName(c)} />
                    {unread && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-red-500" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={clsx("truncate text-[0.84rem]", unread ? "font-semibold text-fg" : "font-medium text-fg-2")}>{fullName(c)}</span>
                      <span className="shrink-0 text-[0.7rem] text-faint">{ago(m.created_at)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[0.8rem] leading-snug text-muted">
                      {m.direction === "outbound" && <span className="text-faint">{m.author === "agent" ? "Assistant: " : "You: "}</span>}{m.body}
                    </span>
                    <span className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge>{m.channel === "sms" ? "Text" : "Email"}</Badge>
                      <StageBadge stage={c.stage} />
                    </span>
                    {f === "needs" && why.get(c.id) && <span className="mt-1.5 block truncate text-[0.75rem] font-medium text-red-600" title={why.get(c.id)}>{why.get(c.id)}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
          {!threads.length && <li className="p-2"><Empty title={f === "needs" ? "Nothing needs you" : "Nothing here"}>{f === "needs" ? "Tasks, drafts to approve and failed sends show up here." : "Replies from drivers land here, email and text together."}</Empty></li>}
        </ul>
      </section>

      {/* Thread */}
      <section className={clsx("min-h-0 flex-col overflow-hidden rounded-[16px] border border-line bg-surface shadow-card", sp.c ? "flex" : "hidden md:flex")}>
        {selected ? <Thread contact={selected} unread={unreadSet.has(selected.id)} back={href({ c: "" }).replace(/[?&]c=$/, "")} /> : (
          <div className="grid flex-1 place-items-center text-sm text-faint">Select a conversation</div>
        )}
      </section>

      {/* Driver context */}
      {selected && <aside className="hidden min-h-0 overflow-y-auto rounded-[16px] border border-line bg-surface p-4 shadow-card xl:block"><Context contact={selected} /></aside>}
    </div>
  );
}

async function Context({ contact: c }: { contact: Contact }) {
  const { supabase } = await requireStaff("/crm/inbox", "inbox.view");
  const { data: form } = await supabase.from("form_links").select("sent_at, opened_at, completed_at").eq("contact_id", c.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const formState = form?.completed_at ? "Completed" : form?.opened_at ? "Opened" : form?.sent_at ? "Sent" : "Not sent";
  return (
    <>
      <h2 className="text-[1.05rem] font-medium tracking-[-0.015em]">Driver context</h2>
      <Link href={`/crm/contacts/${c.id}`} className="mt-4 flex items-center gap-3 rounded-[12px] transition-opacity hover:opacity-75">
        <Avatar name={fullName(c)} className="h-11 w-11 text-sm" />
        <span className="min-w-0">
          <span className="block truncate text-[0.9rem] font-medium">{fullName(c)}</span>
          <span className="block truncate text-[0.78rem] text-muted">{c.company_name}</span>
        </span>
      </Link>
      <Card className="mt-4 grid grid-cols-2 gap-3 p-3 shadow-none">
        <div><p className="text-[0.75rem] text-muted">Driver form</p><p className="mt-0.5 text-[0.95rem] font-medium">{formState}</p></div>
        <div><p className="text-[0.75rem] text-muted">Last reply</p><p className="mt-0.5 text-[0.95rem] font-medium">{c.last_inbound_at ? ago(c.last_inbound_at) : "None"}</p></div>
      </Card>
      <div className="mt-5">
        <Label>Status</Label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <StageBadge stage={c.stage} />
          <Badge dot tone={c.agent_mode === "auto" ? "info" : "warn"}>{c.agent_mode === "auto" ? "Assistant on" : "Manual"}</Badge>
          <Badge dot tone={c.sms_consent && !c.do_not_contact ? "good" : "neutral"}>{c.sms_consent && !c.do_not_contact ? "Can text" : "No text consent"}</Badge>
          {c.do_not_contact && <Badge dot tone="bad">Do not contact</Badge>}
        </div>
      </div>
      <dl className="mt-5 space-y-3 text-[0.84rem]">
        {([["Email", c.email], ["Phone", phoneDisplay(c.cell_phone ?? c.phone)], ["Location", [c.city, c.state].filter(Boolean).join(", ")], ["Local time", localTime(c.timezone)], ["Lead tier", c.tier ? TIERS[c.tier] : null]] as const).map(([k, v]) => v ? (
          <div key={k} className="flex justify-between gap-3"><dt className="shrink-0 text-muted">{k}</dt><dd className="min-w-0 truncate text-right text-fg" title={String(v)}>{v}</dd></div>
        ) : null)}
      </dl>
    </>
  );
}

async function Thread({ contact: c, unread, back }: { contact: Contact; unread: boolean; back: string }) {
  const { supabase } = await requireStaff("/crm/inbox", "inbox.view");
  const items = await loadTimeline(supabase, c.id);
  const hasEmailThread = items.some((m) => m.kind === "message" && m.channel === "email");
  return (
    <>
      <MarkRead contactId={c.id} unread={unread} />
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={back || "/crm/inbox"} className="text-sm text-faint md:hidden">←</Link>
          <Avatar name={fullName(c)} className="h-9 w-9" />
          <div className="min-w-0">
            <Link href={`/crm/contacts/${c.id}`} className="text-[0.95rem] font-semibold tracking-[-0.01em] hover:underline">{fullName(c)}</Link>
            <p className="truncate text-[0.75rem] text-faint">{[c.company_name, phoneDisplay(c.cell_phone ?? c.phone), localTime(c.timezone) && `${localTime(c.timezone)} local`].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StageBadge stage={c.stage} />
          <Badge tone={c.agent_mode === "auto" ? "info" : "warn"} dot>{c.agent_mode === "auto" ? "Assistant on" : "Manual"}</Badge>
          <form action={setAgentMode}>
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="mode" value={c.agent_mode === "auto" ? "manual" : "auto"} />
            <button className="rounded-[9px] border border-line-strong px-2.5 py-1 text-[0.78rem] font-medium transition-colors duration-150 hover:bg-hover">{c.agent_mode === "auto" ? "Take over" : "Hand back to assistant"}</button>
          </form>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5"><Timeline items={items} oldestFirst /></div>
      <div className="space-y-3 p-3">
        <Drafts supabase={supabase} contactId={c.id} />
        <GiveAnswer contactId={c.id} />
        <Composer
          contactId={c.id}
          sendingOn={await isSendingOn()}
          email={c.do_not_contact || !c.email_consent ? { ok: false, why: "Email is off for this driver" } : hasEmailThread ? { ok: true } : { ok: false, why: "No email thread yet: the first email comes from a campaign" }}
          sms={c.do_not_contact ? { ok: false, why: "Driver is do-not-contact" } : c.sms_consent || answeringText(items) ? { ok: true } : { ok: false, why: "No text consent yet" }}
        />
      </div>
    </>
  );
}
