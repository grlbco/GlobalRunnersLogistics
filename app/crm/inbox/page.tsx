import Link from "next/link";
import { Suspense } from "react";
import { clsx } from "clsx";
import { requireStaff } from "@/lib/crm/auth";
import { isSendingOn } from "@/lib/crm/sending";
import { ago, fullName, phoneDisplay } from "@/lib/crm/format";
import { localTime } from "@/lib/crm/timezones";
import { Skeleton, StageBadge } from "@/components/crm/ui";
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
  const { supabase } = await requireStaff("/crm/inbox");

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
    <div className="grid h-dvh grid-rows-[auto_1fr] md:grid-cols-[22rem_1fr] md:grid-rows-1">
      {/* List */}
      <section className={clsx("flex min-h-0 flex-col border-r border-white/[0.07]", sp.c && "hidden md:flex")}>
        <header className="border-b border-white/[0.07] px-4 pb-3 pt-5">
          <h1 className="text-[1.35rem] font-semibold tracking-[-0.03em]">Inbox</h1>
          <nav className="mt-3 flex flex-wrap gap-1.5">
            {FILTERS.map((x) => (
              <Link key={x.key} href={href({ f: x.key })} className={clsx("rounded-full px-2.5 py-1 text-xs", f === x.key ? "bg-white text-ink" : "bg-white/[0.05] text-white/60 hover:text-white")}>
                {x.label}{x.key === "unread" && unreadSet.size ? ` · ${unreadSet.size}` : ""}
              </Link>
            ))}
          </nav>
        </header>
        <ul className="min-h-0 flex-1 divide-y divide-white/[0.05] overflow-y-auto">
          {threads.map((m) => {
            const c = m.contact as unknown as Contact;
            const unread = unreadSet.has(c.id);
            return (
              <li key={m.id}>
                <Link href={href({ c: c.id })} className={clsx("block px-4 py-3 transition-colors", c.id === selectedId ? "bg-white/[0.06]" : "hover:bg-white/[0.03]")}>
                  <div className="flex items-center justify-between gap-2">
                    <p className={clsx("truncate text-sm", unread ? "font-semibold text-white" : "text-white/85")}>
                      {unread && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-signal align-middle" />}
                      {fullName(c)}
                    </p>
                    <span className="shrink-0 text-[0.7rem] text-white/40">{ago(m.created_at)}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[0.8rem] text-white/50">
                    <span className="mr-1.5 font-mono text-[0.6rem] uppercase text-white/35">{m.channel === "sms" ? "text" : "email"}</span>
                    {m.direction === "outbound" && "You: "}{m.body}
                  </p>
                </Link>
              </li>
            );
          })}
          {!threads.length && <li className="px-4 py-16 text-center text-sm text-white/45">Nothing here.</li>}
        </ul>
      </section>

      {/* Thread */}
      <section className={clsx("min-h-0 flex-col", sp.c ? "flex" : "hidden md:flex")}>
        {selected ? <Thread contact={selected} unread={unreadSet.has(selected.id)} back={href({ c: "" }).replace(/[?&]c=$/, "")} /> : (
          <div className="grid flex-1 place-items-center text-sm text-white/45">Select a conversation</div>
        )}
      </section>
    </div>
  );
}

async function Thread({ contact: c, unread, back }: { contact: Contact; unread: boolean; back: string }) {
  const { supabase } = await requireStaff("/crm/inbox");
  const items = await loadTimeline(supabase, c.id);
  const hasEmailThread = items.some((m) => m.kind === "message" && m.channel === "email");
  return (
    <>
      <MarkRead contactId={c.id} unread={unread} />
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
        <div className="min-w-0">
          <Link href={back || "/crm/inbox"} className="mb-1 block text-xs text-white/45 md:hidden">← Inbox</Link>
          <Link href={`/crm/contacts/${c.id}`} className="text-base font-semibold hover:underline">{fullName(c)}</Link>
          <p className="truncate text-xs text-white/45">{[c.company_name, phoneDisplay(c.cell_phone ?? c.phone), localTime(c.timezone) && `${localTime(c.timezone)} local`].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex items-center gap-2">
          <StageBadge stage={c.stage} />
          <span className="text-xs text-white/40">{c.agent_mode === "auto" ? "Auto" : "Manual"}</span>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6"><Timeline items={items} oldestFirst /></div>
      <div className="space-y-3 border-t border-white/[0.07] p-4">
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
