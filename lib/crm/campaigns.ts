import "server-only";
import { adminDb } from "./admin";
import * as instantly from "@/lib/integrations/instantly";

export type Variant = { subject: string; body: string };
export type SeqStep = { delay_days: number; variants: Variant[] };
export type CampaignSettings = { accounts: string[]; daily_limit: number; from: string; to: string; days: number[]; timezone: string; tiers?: number[] };

const FOOTER = "\n\nGlobal Runners Logistics LLC · 732 S 6th St, Ste V, Las Vegas, NV 89101\nNot interested? Reply \"stop\" and we won't email again.";

/** Starter sequence (Claude's first draft): 3 steps, A/B/C on the opener. Only confirmed facts, no pay rates. */
export const DEFAULT_SEQUENCE: SeqStep[] = [
  {
    delay_days: 0,
    variants: [
      { subject: "CDL-A jobs out of Henderson", body: `Hi {{firstName}},\n\nThis is the recruiting team at Global Runners Logistics in Las Vegas. We're hiring CDL-A drivers out of our Henderson yard: automatic Peterbilts and Cascadias, weekly pay every Thursday, and you take the truck home.\n\nWorth a quick call with Ken, our owner, this week?\n\nGlobal Runners Logistics recruiting team${FOOTER}` },
      { subject: "{{firstName}}, still driving?", body: `Hi {{firstName}},\n\nIf running your own authority is getting old, we're hiring company drivers in Las Vegas. Steady freight on our Nevada to Georgia lane, paid every Thursday, and a $1,000 bonus every work anniversary.\n\nWant the details?\n\nGlobal Runners Logistics recruiting team${FOOTER}` },
      { subject: "quick question", body: `Hi {{firstName}},\n\nWould you be open to a company driver seat with a dedicated dispatcher, 24/7 in English or Spanish, and no driver-facing camera?\n\nWe run 30 trucks out of Henderson, NV. Reply yes and we'll send the details.\n\nGlobal Runners Logistics recruiting team${FOOTER}` },
    ],
  },
  {
    delay_days: 3,
    variants: [{ subject: "", body: `Hi {{firstName}}, bumping this up. Riders and pets are welcome, and orientation is one day in Henderson.\n\nShould we send you the short form? It takes a few minutes.\n\nGlobal Runners Logistics recruiting team${FOOTER}` }],
  },
  {
    delay_days: 4,
    variants: [{ subject: "", body: `Last note from us, {{firstName}}. If now's not the time, no problem at all. If it is, reply "yes" and Ken will give you a call.\n\nGlobal Runners Logistics recruiting team${FOOTER}` }],
  },
];

export const DEFAULT_SETTINGS: CampaignSettings = { accounts: [], daily_limit: 30, from: "08:00", to: "17:00", days: [1, 2, 3, 4, 5], timezone: "America/Chicago", tiers: [1] };

const STATUS: Record<number, string> = { 0: "draft", 1: "active", 2: "paused", 3: "completed", 4: "active", [-1]: "error", [-2]: "error" };

export async function pushToInstantly(campaignId: string) {
  const db = adminDb();
  const { data: c } = await db.from("campaigns").select("*").eq("id", campaignId).single();
  if (!c) throw new Error("Campaign not found");
  if (c.instantly_id) return c.instantly_id as string;
  const s = { ...DEFAULT_SETTINGS, ...(c.settings as Partial<CampaignSettings>) };
  if (!s.accounts.length) throw new Error("Pick at least one sending inbox first");
  const seq = c.sequence as SeqStep[];
  if (!seq.length || !seq[0].variants.length) throw new Error("The sequence is empty");
  const created = await instantly.createCampaign({ name: c.name, email_list: s.accounts, daily_limit: s.daily_limit, schedule: { from: s.from, to: s.to, days: s.days, timezone: s.timezone }, steps: seq });
  await db.from("campaigns").update({ instantly_id: created.id, status: "paused", error: null }).eq("id", campaignId);
  return created.id;
}

/** Adds the next wave of contacts (by tier/state) that aren't in any campaign yet. */
export async function addWave(campaignId: string, opts: { tiers: number[]; states?: string[]; count: number }) {
  const db = adminDb();
  const { data: c } = await db.from("campaigns").select("instantly_id, leads_added").eq("id", campaignId).single();
  if (!c?.instantly_id) throw new Error("Create the campaign in Instantly first");
  const { data: taken } = await db.from("campaign_members").select("contact_id");
  const takenSet = new Set((taken ?? []).map((t) => t.contact_id as string));
  let q = db
    .from("contacts")
    .select("id, email, first_name, last_name, company_name, phone, city, state, tier, usdot")
    .in("tier", opts.tiers.length ? opts.tiers : [1, 2, 3, 4, 5])
    .eq("do_not_contact", false)
    .eq("email_consent", true)
    .eq("stage", "new")
    .not("email", "is", null)
    .order("tier")
    .order("usdot")
    .limit(Math.min(opts.count * 2 + 500, 6000));
  if (opts.states?.length) q = q.in("state", opts.states);
  const { data: rows } = await q;
  const { data: suppressed } = await db.from("suppressions").select("value").eq("channel", "email");
  const sup = new Set((suppressed ?? []).map((s) => s.value as string));
  const pick = (rows ?? []).filter((r) => !takenSet.has(r.id) && !sup.has(r.email!)).slice(0, opts.count);
  if (!pick.length) return 0;
  await instantly.addLeads(
    c.instantly_id,
    pick.map((r) => ({
      email: r.email!,
      first_name: r.first_name ?? undefined,
      last_name: r.last_name ?? undefined,
      company_name: r.company_name ?? undefined,
      phone: r.phone ?? undefined,
      custom_variables: { city: r.city ?? "", state: r.state ?? "", tier: String(r.tier ?? ""), usdot: String(r.usdot ?? "") },
    })),
  );
  for (let i = 0; i < pick.length; i += 1000) {
    await db.from("campaign_members").insert(pick.slice(i, i + 1000).map((r) => ({ campaign_id: campaignId, contact_id: r.id })));
  }
  await db.from("campaigns").update({ leads_added: (c.leads_added ?? 0) + pick.length }).eq("id", campaignId);
  return pick.length;
}

/** Pulls status + analytics (campaign and per step/variant) for live campaigns. Throttled to every 15 minutes. */
export async function syncCampaignStats(force = false) {
  const db = adminDb();
  const cutoff = new Date(Date.now() - 15 * 60_000).toISOString();
  let q = db.from("campaigns").select("id, instantly_id").not("instantly_id", "is", null);
  if (!force) q = q.or(`stats_synced_at.is.null,stats_synced_at.lt.${cutoff}`);
  const { data } = await q.limit(10);
  for (const c of data ?? []) {
    try {
      const [meta, overall, steps] = await Promise.all([instantly.getCampaign(c.instantly_id!), instantly.campaignAnalytics(c.instantly_id!), instantly.stepAnalytics(c.instantly_id!).catch(() => [])]);
      await db.from("campaigns").update({ status: STATUS[meta.status] ?? "paused", stats: { overall, steps }, stats_synced_at: new Date().toISOString(), error: null }).eq("id", c.id);
    } catch (e) {
      await db.from("campaigns").update({ error: (e instanceof Error ? e.message : String(e)).slice(0, 300), stats_synced_at: new Date().toISOString() }).eq("id", c.id);
    }
  }
  return data?.length ?? 0;
}
