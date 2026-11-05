import Link from "next/link";
import { Suspense } from "react";
import { requireStaff } from "@/lib/crm/auth";
import { STAGES, TIERS } from "@/lib/crm/stages";
import { ago, fullName, n, phoneDisplay } from "@/lib/crm/format";
import { Avatar, btnCls, btnGhostCls, Empty, inputCls, PageHead, selectCls, Skeleton, StageBadge } from "@/components/crm/ui";

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
  const { supabase } = await requireStaff("/crm/contacts", "contacts.view");
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
        <label className="relative">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
          <input name="q" defaultValue={sp.q} placeholder="Search name, company, email, USDOT, phone, city" className={`${inputCls} pl-9`} />
        </label>
        <select name="stage" defaultValue={sp.stage ?? ""} className={selectCls}>
          <option value="">All stages</option>
          {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select name="tier" defaultValue={sp.tier ?? ""} className={selectCls}>
          <option value="">All tiers</option>
          {Object.entries(TIERS).map(([t, l]) => <option key={t} value={t}>{t} · {l}</option>)}
        </select>
        <input name="state" defaultValue={sp.state} placeholder="State" maxLength={2} className={`${inputCls} uppercase`} />
        <button className={btnCls}>Filter</button>
      </form>

      <p className="mt-4 text-xs text-faint">
        {error ? <span className="text-red-600">{error.message}</span> : <>~{n(count)} contacts{q || sp.stage || sp.tier || sp.state ? " match" : ""} · page {page} of {n(pages)}</>}
      </p>

      <div className="mt-3 overflow-x-auto rounded-[10px] border border-line shadow-card">
        <table className="w-full min-w-[860px] text-left text-[0.84rem]">
          <thead className="border-b border-line bg-subtle text-[0.75rem] text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Tier</th>
              <th className="px-4 py-3 font-medium">Stage</th>
              <th className="px-4 py-3 text-right font-medium">Last reply</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data?.map((c) => (
              <tr key={c.id} className="transition-colors hover:bg-subtle">
                <td className="px-4 py-2.5">
                  <Link href={`/crm/contacts/${c.id}`} className="flex items-center gap-3">
                    <Avatar name={fullName(c)} className="h-7 w-7 text-[0.65rem]" />
                    <span className="min-w-0">
                      <span className="block font-medium text-fg hover:underline">{fullName(c)}</span>
                      <span className="block truncate text-[0.75rem] text-faint">{c.email}</span>
                    </span>
                  </Link>
                </td>
                <td className="max-w-[16rem] truncate px-4 py-2.5 text-muted">{c.company_name}</td>
                <td className="px-4 py-2.5 tabular-nums text-muted">{phoneDisplay(c.phone)}</td>
                <td className="px-4 py-2.5 text-muted">{[c.city, c.state].filter(Boolean).join(", ")}</td>
                <td className="px-4 py-2.5">{c.tier ? <span className="rounded-[5px] border border-line px-1.5 py-px font-mono text-[0.7rem] text-muted">T{c.tier}</span> : <span className="text-ghost">—</span>}</td>
                <td className="px-4 py-2.5"><StageBadge stage={c.stage} /></td>
                <td className="px-4 py-2.5 text-right text-faint">{ago(c.last_inbound_at)}</td>
              </tr>
            ))}
            {!data?.length && (
              <tr><td colSpan={7} className="p-4"><Empty title="No contacts found">Try a different search or clear the filters.</Empty></td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-between text-sm">
        {page > 1 ? <Link href={qs({ page: String(page - 1) })} className={btnGhostCls}>← Previous</Link> : <span />}
        {page < pages && <Link href={qs({ page: String(page + 1) })} className={btnGhostCls}>Next →</Link>}
      </div>
    </div>
  );
}
