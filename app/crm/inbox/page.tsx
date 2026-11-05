import Link from "next/link";
import { Suspense } from "react";
import { clsx } from "clsx";
import { requireStaff } from "@/lib/crm/auth";
import { isSendingOn } from "@/lib/crm/sending";
import { ago, fullName, phoneDisplay } from "@/lib/crm/format";
import { localTime } from "@/lib/crm/timezones";
import { Avatar, Badge, Empty, Skeleton, StageBadge } from "@/components/crm/ui";
import { Composer } from "@/components/crm/Composer";
import { Drafts } from "@/components/crm/Drafts";
import { Timeline, loadTimeline } from "@/components/crm/Timeline";
import { MarkRead } from "@/components/crm/MarkRead";

export const metadata = { title: "Inbox" };

type SP = Promise<{ c?: string; f?: string }>;
const FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "reply", label: "Needs reply" },
  { key: "sms", label: "Texts" },
  { key: "email", label: "Emails" },
] as const;

export default function InboxPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<div className="p-5 md:p-8"><Skeleton className="h-[80vh]" /></div>}>
      <Inbox searchParams={searchParams} />
    </Suspense>
  );
}

type Contact = { id: string; first_name: string | null; last_name: string | null; company_name: string | null; stage: string; agent_mode: string; cell_phone: string | null; phone: string | null; email: string | null; timezone: string | null; do_not_contact: boolean; email_consent: boolean; sms_consent: boolean };

async function Inbox({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const f = FILTERS.some((x) => x.key === sp.f) ? sp.f! : "all";
  const { supabase } = await requireStaff("/crm/inbox", "inbox.view");

  let q = supabase
    .from("messages")
    .select("id, channel, direction, author, body, created_at, contact:contacts(id, first_name, last_name, company_name, stage, agent_mode, cell_phone, phone, email, timezone, do_not_contact, email_consent, sms_consent)")
    .neq("channel", "call")
    .order("created_at", { ascending: false })
    .limit(500);
  if (f === "sms" || f === "email") q = q.eq("channel", f);
  const [{ data }, { data: unreadRows }] = await Promise.all([q, supabase.from("conversations").select("contact_id").eq("unread", true)]);
  const unreadSet = new Set((unreadRows ?? []).map((r) => r.contact_id as string));

  const seen = new Set<string>();
  let threads = (data ?? []).filter((m) => {
    const c = m.contact as unknown as Contact | null;
    if (!c || seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
  if (f === "unread") threads = threads.filter((m) => unreadSet.has((m.contact as unknown as Contact).id));
  if (f === "reply") threads = threads.filter((m) => m.direction === "inbound");

  const selectedId = sp.c ?? (threads[0]?.contact as unknown as Contact | undefined)?.id;
  const selected = (threads.find((m) => (m.contact as unknown as Contact).id === selectedId)?.contact ?? null) as unknown as Contact | null;
  const href = (patch: { c?: string; f?: string }) => {
    const p = new URLSearchParams();
    const nf = patch.f ?? f;
    if (nf !== "all") p.set("f", nf);
    const nc = patch.c ?? (patch.f ? undefined : selectedId);
    if (nc) p.set("c", nc);
    return `/crm/inbox${p.size ? `?${p}` : ""}`;
  };

  return (
    <div className="grid h-[calc(100dvh-5rem)] grid-rows-[auto_1fr] md:h-[calc(100dvh-1rem-2px)] md:grid-cols-[22rem_1fr] md:grid-rows-1">
      {/* List */}
      <section className={clsx("flex min-h-0 flex-col border-r border-line", sp.c && "hidden md:flex")}>
        <header className="border-b border-line px-4 pb-3 pt-5">
          <div className="flex items-baseline justify-between">
            <h1 className="text-[1.375rem] font-semibold tracking-[-0.025em]">Inbox</h1>
            {unreadSet.size > 0 && <span className="text-[0.75rem] font-medium text-signal-ink">{unreadSet.size} unread</span>}
          </div>
          <nav className="mt-3 flex flex-wrap gap-0.5 rounded-[8px] border border-line bg-subtle p-0.5">
            {FILTERS.map((x) => (
              <Link key={x.key} href={href({ f: x.key })} className={clsx("flex-1 rounded-[6px] px-2 py-1 text-center text-[0.75rem] font-medium transition-all", f === x.key ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg")}>
                {x.label}
              </Link>
            ))}
          </nav>
        </header>
        <ul className="min-h-0 flex-1 space-y-px overflow-y-auto p-2">
          {threads.map((m) => {
            const c = m.contact as unknown as Contact;
            const unread = unreadSet.has(c.id);
            return (
              <li key={m.id}>
                <Link href={href({ c: c.id })} className={clsx("flex gap-3 rounded-[9px] px-3 py-2.5 transition-colors", c.id === selectedId ? "bg-hover" : "hover:bg-subtle")}>
                  <span className="relative">
                    <Avatar name={fullName(c)} />
                    {unread && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-signal" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={clsx("truncate text-[0.84rem]", unread ? "font-semibold text-fg" : "font-medium text-fg-2")}>{fullName(c)}</span>
                      <span className="shrink-0 text-[0.7rem] text-faint">{ago(m.created_at)}</span>
                    </span>
                    <span className="mt-0.5 line-clamp-2 text-[0.78rem] leading-snug text-muted">
                      <span className="mr-1.5 rounded-[4px] bg-hover px-1 py-px font-mono text-[0.58rem] uppercase text-faint">{m.channel === "sms" ? "text" : "email"}</span>
                      {m.direction === "outbound" && <span className="text-faint">You: </span>}{m.body}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
          {!threads.length && <li className="p-2"><Empty title="Nothing here">Replies from drivers land here, email and text together.</Empty></li>}
        </ul>
      </section>

      {/* Thread */}
      <section className={clsx("min-h-0 flex-col", sp.c ? "flex" : "hidden md:flex")}>
        {selected ? <Thread contact={selected} unread={unreadSet.has(selected.id)} back={href({ c: "" }).replace(/[?&]c=$/, "")} /> : (
          <div className="grid flex-1 place-items-center bg-subtle/60 text-sm text-faint">Select a conversation</div>
        )}
      </section>
    </div>
  );
}

async function Thread({ contact: c, unread, back }: { contact: Contact; unread: boolean; back: string }) {
  const { supabase } = await requireStaff("/crm/inbox", "inbox.view");
  const items = await loadTimeline(supabase, c.id);
  const hasEmailThread = items.some((m) => m.kind === "message" && m.channel === "email");
  return (
    <>
      <MarkRead contactId={c.id} unread={unread} />
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
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
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto bg-subtle/50 px-5 py-6"><Timeline items={items} oldestFirst /></div>
      <div className="space-y-3 border-t border-line bg-surface p-4">
        <Drafts supabase={supabase} contactId={c.id} />
        <Composer
          contactId={c.id}
          sendingOn={await isSendingOn()}
          email={c.do_not_contact || !c.email_consent ? { ok: false, why: "Email is off for this driver" } : hasEmailThread ? { ok: true } : { ok: false, why: "No email thread yet: the first email comes from a campaign" }}
          sms={c.do_not_contact ? { ok: false, why: "Driver is do-not-contact" } : c.sms_consent ? { ok: true } : { ok: false, why: "No text consent yet" }}
        />
      </div>
    </>
  );
}
