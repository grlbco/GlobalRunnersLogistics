import "server-only";
import { company } from "@/content/facts";

/**
 * Lead notifications. Every channel is optional and env-gated; failures are logged, never thrown,
 * so a down provider can't lose an application (the row is already saved in Supabase).
 *
 * Env:
 *   RESEND_API_KEY, NOTIFY_EMAIL_FROM (e.g. "Global Runners <apply@globalrunnerslogistics.com>"), NOTIFY_EMAIL_TO
 *   QUO_API_KEY, QUO_FROM_NUMBER (+17256661558), NOTIFY_SMS_TO (recruiter cell, E.164)
 */

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function sendEmail(to: string | string[], subject: string, html: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_EMAIL_FROM;
  if (!key || !from) return { skipped: true as const };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    if (!res.ok) console.error("resend", res.status, await res.text());
    return { ok: res.ok };
  } catch (e) {
    console.error("resend error", e);
    return { ok: false };
  }
}

export async function sendSms(to: string, content: string) {
  const key = process.env.QUO_API_KEY;
  const from = process.env.QUO_FROM_NUMBER ?? company.smsSender;
  if (!key) return { skipped: true as const };
  try {
    // Quo (formerly OpenPhone) public API.
    const res = await fetch("https://api.openphone.com/v1/messages", {
      method: "POST",
      headers: { Authorization: key, "Content-Type": "application/json" },
      body: JSON.stringify({ content, from, to: [to] }),
    });
    if (!res.ok) console.error("quo", res.status, await res.text());
    return { ok: res.ok };
  } catch (e) {
    console.error("quo error", e);
    return { ok: false };
  }
}

export function table(rows: [string, string | undefined | null][]) {
  const body = rows
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font:13px system-ui">${esc(k)}</td><td style="padding:6px 0;font:14px system-ui;color:#0a1220">${esc(String(v))}</td></tr>`,
    )
    .join("");
  return `<table cellpadding="0" cellspacing="0">${body}</table>`;
}

/** Recruiter alert for a new lead: SMS + email. */
export async function notifyRecruiter(opts: { subject: string; sms: string; rows: [string, string | undefined | null][] }) {
  const tasks: Promise<unknown>[] = [];
  const smsTo = process.env.NOTIFY_SMS_TO;
  if (smsTo) tasks.push(sendSms(smsTo, opts.sms));
  const emailTo = process.env.NOTIFY_EMAIL_TO;
  if (emailTo) {
    const html = `<div style="font:14px system-ui"><h2 style="font:600 18px system-ui;margin:0 0 12px">${esc(opts.subject)}</h2>${table(opts.rows)}</div>`;
    const text = opts.rows.map(([k, v]) => `${k}: ${v ?? ""}`).join("\n");
    tasks.push(sendEmail(emailTo.split(","), opts.subject, html, text));
  }
  await Promise.allSettled(tasks);
}
