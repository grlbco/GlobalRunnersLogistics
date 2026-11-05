import "server-only";
import { callJson } from "./http";

/** Instantly API v2 (Bearer key). */
const BASE = "https://api.instantly.ai/api/v2";
const headers = () => {
  const k = process.env.INSTANTLY_API_KEY;
  if (!k) throw new Error("INSTANTLY_API_KEY is not set");
  return { Authorization: `Bearer ${k}`, "Content-Type": "application/json" };
};

export type InstantlyEmail = {
  id: string;
  timestamp_created: string;
  timestamp_email?: string;
  subject?: string;
  from_address_email?: string;
  to_address_email_list?: string;
  body?: { text?: string; html?: string };
  content_preview?: string;
  lead?: string;
  eaccount?: string;
  thread_id?: string;
  campaign_id?: string | null;
  ue_type?: number; // 1 campaign sent, 2 received, 3 manual sent, 4 scheduled
  is_auto_reply?: number;
  i_status?: number | null;
};

/** Newest first. `search` can be a lead email or `thread:<id>`. */
export async function listEmails(params: { limit?: number; startingAfter?: string; search?: string } = {}) {
  const q = new URLSearchParams({ limit: String(params.limit ?? 100), sort_order: "desc" });
  if (params.startingAfter) q.set("starting_after", params.startingAfter);
  if (params.search) q.set("search", params.search);
  return callJson<{ items: InstantlyEmail[]; next_starting_after?: string }>("instantly", `${BASE}/emails?${q}`, { headers: headers() });
}

/** Reply in the same thread from the same inbox. */
export async function replyToEmail(p: { eaccount: string; replyToUuid: string; subject: string; text: string }) {
  const html = p.text
    .split(/\n{2,}/)
    .map((para) => para.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br/>"))
    .join("<br/><br/>");
  return callJson<{ id?: string }>("instantly", `${BASE}/emails/reply`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      eaccount: p.eaccount,
      reply_to_uuid: p.replyToUuid,
      subject: /^re:/i.test(p.subject) ? p.subject : `Re: ${p.subject}`,
      body: { text: p.text, html },
    }),
    retries: 0,
  });
}

/** 1 interested, 0 out of office, -1 not interested. */
export async function setInterest(leadEmail: string, interestValue: number) {
  return callJson("instantly", `${BASE}/leads/update-interest-status`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ lead_email: leadEmail, interest_value: interestValue }),
    retries: 1,
  });
}

// ---------------- campaigns ----------------

const get = <T>(path: string) => callJson<T>("instantly", `${BASE}${path}`, { headers: headers() });

export type InstantlyAccount = { email: string; status?: number; warmup_status?: number; daily_limit?: number; provider_code?: number };
export async function listAccounts(): Promise<InstantlyAccount[]> {
  const r = await get<{ items: InstantlyAccount[] }>("/accounts?limit=100");
  return r.items ?? [];
}

export type CampaignPayload = {
  name: string;
  email_list: string[];
  daily_limit: number;
  schedule: { from: string; to: string; days: number[]; timezone: string };
  steps: { delay_days: number; variants: { subject: string; body: string }[] }[];
};

const toHtml = (text: string) =>
  text
    .split(/\n/)
    .map((l) => (l.trim() ? `<div>${l.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div>` : "<div><br></div>"))
    .join("");

/** Creates the campaign in Instantly. It starts paused/draft until activated. */
export async function createCampaign(p: CampaignPayload): Promise<{ id: string }> {
  const days = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), p.schedule.days.includes(d)]));
  return callJson<{ id: string }>("instantly", `${BASE}/campaigns`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      name: p.name,
      email_list: p.email_list,
      daily_limit: p.daily_limit,
      stop_on_reply: true,
      stop_on_auto_reply: true,
      link_tracking: false,
      open_tracking: true,
      text_only: false,
      campaign_schedule: { schedules: [{ name: "Business hours", timing: { from: p.schedule.from, to: p.schedule.to }, days, timezone: p.schedule.timezone }] },
      sequences: [
        {
          steps: p.steps.map((s) => ({
            type: "email",
            delay: s.delay_days,
            variants: s.variants.map((v) => ({ subject: v.subject, body: toHtml(v.body) })),
          })),
        },
      ],
    }),
    retries: 0,
  });
}

export const activateCampaign = (id: string) => callJson("instantly", `${BASE}/campaigns/${id}/activate`, { method: "POST", headers: headers(), retries: 0 });
export const pauseCampaign = (id: string) => callJson("instantly", `${BASE}/campaigns/${id}/pause`, { method: "POST", headers: headers(), retries: 0 });
export const getCampaign = (id: string) => get<{ id: string; status: number; name: string }>(`/campaigns/${id}`);

export type LeadIn = { email: string; first_name?: string; last_name?: string; company_name?: string; phone?: string; custom_variables?: Record<string, string | number | boolean> };
/** Bulk add (≤1,000 per call), skipping anyone already in the workspace. */
export async function addLeads(campaignId: string, leads: LeadIn[]) {
  let added = 0;
  for (let i = 0; i < leads.length; i += 1000) {
    const r = await callJson<{ leads_uploaded?: number; uploaded?: number }>("instantly", `${BASE}/leads/add`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ campaign_id: campaignId, skip_if_in_workspace: true, leads: leads.slice(i, i + 1000) }),
      timeoutMs: 60000,
      retries: 1,
    });
    added += r.leads_uploaded ?? r.uploaded ?? Math.min(1000, leads.length - i);
  }
  return added;
}

export async function campaignAnalytics(id: string) {
  const r = await get<Record<string, number | string>[] | Record<string, number | string>>(`/campaigns/analytics?id=${id}`);
  return Array.isArray(r) ? r[0] ?? {} : r;
}

export async function stepAnalytics(id: string) {
  return get<{ step?: string | number; variant?: string | number; sent?: number; opened?: number; unique_opened?: number; replies?: number; unique_replies?: number; clicks?: number }[]>(`/campaigns/analytics/steps?campaign_id=${id}`);
}
