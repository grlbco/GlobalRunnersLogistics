import Link from "next/link";
import { Suspense } from "react";
import { clsx } from "clsx";
import { requireStaff } from "@/lib/crm/auth";
import { ago, fullName } from "@/lib/crm/format";
import { PageHead, Skeleton, StageBadge } from "@/components/crm/ui";

export const metadata = { title: "Inbox" };

export default function InboxPage() {
  return (
    <>
      <PageHead title="Inbox" sub="Every email and text from drivers, newest first" />
      <Suspense fallback={<div className="p-5 md:p-8"><Skeleton className="h-[60vh]" /></div>}>
        <List />
      </Suspense>
    </>
  );
}

async function List() {
  const { supabase } = await requireStaff("/crm/inbox");
  const { data } = await supabase
    .from("messages")
    .select("id, channel, direction, author, body, created_at, contact:contacts(id, first_name, last_name, company_name, stage, agent_mode)")
    .order("created_at", { ascending: false })
    .limit(300);

  // newest message per contact
  const seen = new Set<string>();
  const threads = (data ?? []).filter((m) => {
    const c = m.contact as unknown as { id: string } | null;
    if (!c || seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  if (!threads.length)
    return (
      <div className="p-5 md:p-8">
        <div className="rounded-[6px] border border-dashed border-white/10 p-16 text-center">
          <p className="text-sm text-white/60">No conversations yet.</p>
          <p className="mt-1 text-xs text-white/40">Replies from Instantly and texts from Quo land here once the webhooks are connected.</p>
        </div>
      </div>
    );

  return (
    <ul className="divide-y divide-white/[0.06]">
      {threads.map((m) => {
        const c = m.contact as unknown as { id: string; first_name: string | null; last_name: string | null; company_name: string | null; stage: string; agent_mode: string };
        return (
          <li key={m.id}>
            <Link href={`/crm/contacts/${c.id}`} className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-white/[0.03] md:px-8">
              <span className={clsx("mt-1.5 h-2 w-2 shrink-0 rounded-full", m.direction === "inbound" ? "bg-signal" : "bg-white/15")} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium">{fullName(c)} <span className="font-normal text-white/40">· {c.company_name}</span></p>
                  <span className="shrink-0 text-xs text-white/40">{ago(m.created_at)}</span>
                </div>
                <p className="mt-1 line-clamp-1 text-sm text-white/55">
                  <span className="mr-2 font-mono text-[0.65rem] uppercase text-white/35">{m.channel === "sms" ? "text" : m.channel}</span>
                  {m.direction === "outbound" && "You: "}{m.body}
                </p>
              </div>
              <div className="hidden shrink-0 items-center gap-2 sm:flex">
                <StageBadge stage={c.stage} />
                <span className="text-[0.7rem] text-white/40">{c.agent_mode === "auto" ? "Auto" : "Manual"}</span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
