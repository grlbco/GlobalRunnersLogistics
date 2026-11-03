import Link from "next/link";
import { Suspense } from "react";
import { requireStaff } from "@/lib/crm/auth";
import { STAGES, TIERS } from "@/lib/crm/stages";
import { ago, fullName, n, phoneDisplay } from "@/lib/crm/format";
import { PageHead, Skeleton, StageBadge, inputCls, btnCls } from "@/components/crm/ui";

export const metadata = { title: "Contacts" };
const PAGE = 50;

type SP = Promise<{ q?: string; stage?: string; tier?: string; state?: string; page?: string }>;

export default function ContactsPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <PageHead title="Contacts" sub="Every driver lead, one profile each" />
      <Suspense fallback={<div className="p-5 md:p-8"><Skeleton className="h-[60vh]" /></div>}>
        <Table searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Table({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { supabase } = await requireStaff("/crm/contacts");
  const page = Math.max(1, Number(sp.page) || 1);
  const q = (sp.q ?? "").trim().toLowerCase();

  let query = supabase
    .from("contacts")
    .select("id, first_name, last_name, company_name, email, phone, city, state, tier, stage, last_inbound_at, usdot", { count: "estimated" })
    .order("tier", { ascending: true })
    .order("usdot", { ascending: true })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (q) query = query.ilike("search", `%${q.replace(/[%_]/g, "")}%`);
  if (sp.stage) query = query.eq("stage", sp.stage);
  if (sp.tier) query = query.eq("tier", Number(sp.tier));
  if (sp.state) query = query.eq("state", sp.state.toUpperCase());
  const { data, count, error } = await query;

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/crm/contacts?${p}`;
  };
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));

  return (
    <div className="p-5 md:p-8">
      <form className="grid gap-3 md:grid-cols-[1fr_11rem_11rem_6rem_auto]" action="/crm/contacts">
        <input name="q" defaultValue={sp.q} placeholder="Search name, company, email, USDOT, phone, city" className={inputCls} />
        <select name="stage" defaultValue={sp.stage ?? ""} className={inputCls}>
          <option value="">All stages</option>
          {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select name="tier" defaultValue={sp.tier ?? ""} className={inputCls}>
          <option value="">All tiers</option>
          {Object.entries(TIERS).map(([t, l]) => <option key={t} value={t}>{t} · {l}</option>)}
        </select>
        <input name="state" defaultValue={sp.state} placeholder="State" maxLength={2} className={`${inputCls} uppercase`} />
        <button className={btnCls}>Filter</button>
      </form>

      <p className="mt-4 text-xs text-white/45">
        {error ? <span className="text-red-300">{error.message}</span> : <>~{n(count)} contacts{q || sp.stage || sp.tier || sp.state ? " match" : ""} · page {page} of {n(pages)}</>}
      </p>

      <div className="mt-3 overflow-x-auto rounded-[6px] border border-white/[0.08]">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-white/[0.03] font-mono text-[0.65rem] uppercase tracking-[0.12em] text-white/45">
            <tr>
              <th className="px-4 py-3 font-normal">Name</th>
              <th className="px-4 py-3 font-normal">Company</th>
              <th className="px-4 py-3 font-normal">Phone</th>
              <th className="px-4 py-3 font-normal">Location</th>
              <th className="px-4 py-3 font-normal">Tier</th>
              <th className="px-4 py-3 font-normal">Stage</th>
              <th className="px-4 py-3 text-right font-normal">Last reply</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {data?.map((c) => (
              <tr key={c.id} className="transition-colors hover:bg-white/[0.03]">
                <td className="px-4 py-2.5">
                  <Link href={`/crm/contacts/${c.id}`} className="font-medium hover:underline">{fullName(c)}</Link>
                  <div className="truncate text-xs text-white/40">{c.email}</div>
                </td>
                <td className="max-w-[16rem] truncate px-4 py-2.5 text-white/70">{c.company_name}</td>
                <td className="px-4 py-2.5 tabular-nums text-white/70">{phoneDisplay(c.phone)}</td>
                <td className="px-4 py-2.5 text-white/70">{[c.city, c.state].filter(Boolean).join(", ")}</td>
                <td className="px-4 py-2.5 font-mono text-white/60">{c.tier ?? "—"}</td>
                <td className="px-4 py-2.5"><StageBadge stage={c.stage} /></td>
                <td className="px-4 py-2.5 text-right text-white/45">{ago(c.last_inbound_at)}</td>
              </tr>
            ))}
            {!data?.length && (
              <tr><td colSpan={7} className="px-4 py-16 text-center text-white/45">No contacts found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-between text-sm">
        {page > 1 ? <Link href={qs({ page: String(page - 1) })} className="text-white/60 hover:text-white">← Previous</Link> : <span />}
        {page < pages && <Link href={qs({ page: String(page + 1) })} className="text-white/60 hover:text-white">Next →</Link>}
      </div>
    </div>
  );
}
