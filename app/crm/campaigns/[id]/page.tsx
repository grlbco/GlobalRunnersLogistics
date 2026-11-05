import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { clsx } from "clsx";
import { requireStaff } from "@/lib/crm/auth";
import { DEFAULT_SETTINGS, type CampaignSettings, type SeqStep } from "@/lib/crm/campaigns";
import { ago, n } from "@/lib/crm/format";
import { Card, Label, Skeleton, Stat } from "@/components/crm/ui";
import { CampaignEditor } from "@/components/crm/CampaignEditor";
import { CampaignControls } from "@/components/crm/CampaignControls";

export default function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="p-8"><Skeleton className="h-[70vh]" /></div>}>
      <Body params={params} />
    </Suspense>
  );
}

const num = (o: Record<string, unknown> | undefined, ...keys: string[]) => Number(keys.map((k) => o?.[k]).find((v) => v !== undefined && v !== null) ?? 0);
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");

async function Body({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase, staff } = await requireStaff(`/crm/campaigns/${id}`, "campaigns.view");
  const { data: c } = await supabase.from("campaigns").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();

  let accounts: string[] = [];
  try {
    const { listAccounts } = await import("@/lib/integrations/instantly");
    accounts = (await listAccounts()).map((a) => a.email);
  } catch {}
  const head = { count: "exact" as const, head: true };
  const available = Object.fromEntries(
    await Promise.all([1, 2, 3, 4, 5].map(async (t) => [t, (await supabase.from("contacts").select("*", head).eq("tier", t).eq("stage", "new").eq("do_not_contact", false)).count ?? 0] as const)),
  );

  const stats = (c.stats ?? {}) as { overall?: Record<string, unknown>; steps?: { step?: string | number; variant?: string | number; sent?: number; unique_opened?: number; opened?: number; unique_replies?: number; replies?: number }[] };
  const o = stats.overall;
  const sent = num(o, "emails_sent_count");
  const contacted = num(o, "contacted_count") || sent;
  const seq = c.sequence as SeqStep[];
  const settings = { ...DEFAULT_SETTINGS, ...(c.settings as Partial<CampaignSettings>) };
  const isAdmin = staff.can("campaigns.manage");

  return (
    <div className="space-y-3 px-5 md:px-6">
      <div>
        <Link href="/crm/campaigns" className="inline-flex items-center gap-1 text-[0.78rem] text-muted transition-colors hover:text-fg">← Campaigns</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-[1.375rem] font-semibold tracking-[-0.025em]">{c.name}</h1>
          <span className="rounded-full bg-hover px-2 py-0.5 text-xs capitalize text-muted">{c.status}</span>
          {c.stats_synced_at && <span className="text-xs text-faint">stats {ago(c.stats_synced_at)} ago</span>}
        </div>
        {c.error && <p className="mt-2 text-sm text-red-600">{c.error}</p>}
      </div>

      {c.instantly_id && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Leads" value={n(c.leads_added)} />
          <Stat label="Emails sent" value={n(sent)} />
          <Stat label="Opened" value={pct(num(o, "open_count_unique", "open_count"), contacted)} />
          <Stat label="Replied" value={pct(num(o, "reply_count_unique", "reply_count"), contacted)} hint={`${n(num(o, "reply_count_unique", "reply_count"))} replies`} />
          <Stat label="Bounced" value={pct(num(o, "bounced_count"), sent)} hint={num(o, "bounced_count") / Math.max(sent, 1) > 0.03 ? "Over 3%: pause and check inboxes" : undefined} />
        </div>
      )}

      {c.instantly_id && (stats.steps?.length ?? 0) > 0 && (
        <Card className="p-5">
          <Label>A/B/C results</Label>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-[0.75rem] text-muted"><tr><th className="py-2 font-medium">Email</th><th className="font-medium">Version</th><th className="font-medium">Sent</th><th className="font-medium">Open rate</th><th className="font-medium">Reply rate</th></tr></thead>
            <tbody className="divide-y divide-line">
              {(() => {
                const rows = (stats.steps ?? []).map((r) => ({ step: Number(r.step ?? 0), variant: Number(r.variant ?? 0), sent: r.sent ?? 0, open: r.unique_opened ?? r.opened ?? 0, reply: r.unique_replies ?? r.replies ?? 0 }));
                const best = new Map<number, number>();
                for (const r of rows) if (r.sent >= 100) { const rate = r.reply / r.sent; if (rate > (best.get(r.step) ?? -1)) best.set(r.step, rate); }
                return rows.sort((a, b) => a.step - b.step || a.variant - b.variant).map((r, i) => {
                  const lead = r.sent >= 100 && best.get(r.step) === r.reply / r.sent && rows.filter((x) => x.step === r.step).length > 1;
                  return (
                    <tr key={i} className={clsx(lead && "text-emerald-700")}>
                      <td className="py-2">{r.step + 1}</td>
                      <td>{"ABCDE"[r.variant] ?? r.variant}{lead ? " · leading" : ""}</td>
                      <td className="tabular-nums">{n(r.sent)}</td>
                      <td className="tabular-nums">{pct(r.open, r.sent)}</td>
                      <td className="tabular-nums">{pct(r.reply, r.sent)}</td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-faint">A version is marked leading once it has 100+ sends. Pause the loser in Instantly and add a new challenger.</p>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <CampaignEditor id={c.id} initial={{ name: c.name, sequence: seq, settings }} accounts={accounts} locked={!!c.instantly_id || !isAdmin} />
        {isAdmin && <div className="space-y-4"><CampaignControls id={c.id} created={!!c.instantly_id} status={c.status} leadsAdded={c.leads_added} available={available} /></div>}
      </div>
    </div>
  );
}
