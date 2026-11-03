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
