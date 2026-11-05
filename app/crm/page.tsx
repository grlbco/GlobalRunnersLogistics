import Link from "next/link";
import { Suspense } from "react";
import { requireStaff } from "@/lib/crm/auth";
import { FUNNEL, STAGES, TIERS, stageLabel } from "@/lib/crm/stages";
import { ago, fullName, n } from "@/lib/crm/format";
import { Card, Label, PageHead, Skeleton, StageBadge, Stat } from "@/components/crm/ui";
import { GoLive } from "@/components/crm/GoLive";

export default function Dashboard() {
  return (
    <>
      <PageHead title="Dashboard" sub="Recruiting pipeline for Global Runners Logistics" />
      <Suspense fallback={<div className="grid gap-4 p-5 md:grid-cols-4 md:p-8">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>}>
        <Body />
      </Suspense>
    </>
  );
}

function recentStamp() {
  return new Date().toISOString();
}

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

async function count(q: PromiseLike<{ count: number | null }>) {
  return (await q).count ?? 0;
}

async function Body() {
  const { supabase, staff } = await requireStaff("/crm");
  const head = { count: "exact" as const, head: true };
  const since = hoursAgo(24);

  const [total, byStage, byTier, repliesToday, recent, tasks] = await Promise.all([
    count(supabase.from("contacts").select("*", head)),
    Promise.all(STAGES.map(async (s) => [s.key, await count(supabase.from("contacts").select("*", head).eq("stage", s.key))] as const)),
    Promise.all([1, 2, 3, 4, 5].map(async (t) => [t, await count(supabase.from("contacts").select("*", head).eq("tier", t))] as const)),
    count(supabase.from("messages").select("*", head).eq("direction", "inbound").gte("created_at", since)),
    supabase.from("contacts").select("id, first_name, last_name, company_name, stage, last_inbound_at").not("last_inbound_at", "is", null).order("last_inbound_at", { ascending: false }).limit(8),
    supabase.from("tasks").select("id, title, due_at, contact:contacts(id, first_name, last_name, company_name)").is("done_at", null).order("due_at", { nullsFirst: false }).limit(10),
  ]);
  const stage = Object.fromEntries(byStage) as Record<string, number>;
  const reached = (key: string) => {
    // contacts at this stage or any later stage (every in-between stage counts, e.g. Following up, With Ken)
    const ORDER = ["contacted", "replied", "interested", "form_sent", "chasing", "applied", "qualified", "sent_to_ken", "hired"];
    const later = ORDER.slice(Math.max(0, ORDER.indexOf(key)));
    return later.reduce((s, k) => s + (stage[k] ?? 0), 0) + (key === "contacted" ? ["nurture", "not_fit", "not_interested", "unsubscribed", "bounced"].reduce((s, k) => s + (stage[k] ?? 0), 0) : 0);
  };
  const top = Math.max(1, reached("contacted"), total);

  return (
    <div className="space-y-6 p-5 md:p-8">
      <Suspense fallback={<Skeleton className="h-40" />}>
        <GoLive isAdmin={staff.role === "admin"} />
      </Suspense>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Contacts" value={n(total)} hint="Imported driver leads" />
        <Stat label="Replies · 24h" value={n(repliesToday)} hint="Email + text" />
        <Stat label="Forms sent" value={n(stage.form_sent)} hint="Waiting on the driver" />
        <Stat label="Applied" value={n((stage.applied ?? 0) + (stage.qualified ?? 0) + (stage.sent_to_ken ?? 0))} hint={`${n(stage.hired)} hired`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-3">
          <Label>Funnel</Label>
          <div className="mt-5 space-y-3">
            {FUNNEL.map((k) => {
              const v = reached(k);
              return (
                <div key={k} className="grid grid-cols-[7rem_1fr_4rem] items-center gap-3 text-sm">
                  <span className="text-white/60">{stageLabel(k)}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                    <div className="h-full rounded-full bg-signal" style={{ width: `${Math.max(v ? 1 : 0, (v / top) * 100)}%` }} />
                  </div>
                  <span className="text-right tabular-nums text-white/80">{n(v)}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-5 text-xs text-white/40">Bars are relative to all contacts. Campaigns aren&apos;t live yet, so most leads are still New.</p>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <Label>Leads by tier</Label>
          <ul className="mt-4 divide-y divide-white/[0.06] text-sm">
            {byTier.map(([t, v]) => (
              <li key={t} className="flex items-center justify-between py-2.5">
                <Link href={`/crm/contacts?tier=${t}`} className="text-white/70 hover:text-white">
                  <span className="mr-2 font-mono text-white/40">{t}</span>
                  {TIERS[t]}
                </Link>
                <span className="tabular-nums">{n(v)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-5">
        <Label>Open tasks</Label>
        {tasks.data?.length ? (
          <ul className="mt-3 divide-y divide-white/[0.06] text-sm">
            {tasks.data.map((t) => {
              const c = t.contact as unknown as { id: string; first_name: string | null; last_name: string | null; company_name: string | null } | null;
              const late = t.due_at && new Date(t.due_at).getTime() < new Date(recentStamp()).getTime();
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0 truncate">{t.title}{c && <Link href={`/crm/contacts/${c.id}`} className="ml-2 text-white/45 hover:text-white">· {fullName(c)}</Link>}</span>
                  {t.due_at && <span className={late ? "shrink-0 text-xs text-red-300" : "shrink-0 text-xs text-white/40"}>{new Date(t.due_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>}
                </li>
              );
            })}
          </ul>
        ) : <p className="mt-4 text-sm text-white/45">No open tasks.</p>}
      </Card>
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <Label>Latest replies</Label>
          <Link href="/crm/inbox" className="text-xs text-white/50 hover:text-white">Open inbox →</Link>
        </div>
        {recent.data?.length ? (
          <ul className="mt-3 divide-y divide-white/[0.06]">
            {recent.data.map((c) => (
              <li key={c.id}>
                <Link href={`/crm/contacts/${c.id}`} className="flex items-center justify-between gap-4 py-3 text-sm hover:text-white">
                  <span className="truncate">{fullName(c)} <span className="text-white/40">· {c.company_name}</span></span>
                  <span className="flex shrink-0 items-center gap-3"><StageBadge stage={c.stage} /><span className="w-10 text-right text-white/40">{ago(c.last_inbound_at)}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-white/45">No replies yet. They&apos;ll show up here as soon as the first campaign goes out.</p>
        )}
      </Card>
      </div>
    </div>
  );
}
