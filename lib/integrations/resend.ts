import "server-only";
import { callJson } from "./http";

/**
 * Direct email to a driver through Resend, for drivers with no Instantly thread
 * (came in by text, the website or a form). From Ken's name on our verified domain.
 * Replies: to RESEND_INBOUND_ADDRESS (lands in the CRM via /api/hooks/resend) when set,
 * otherwise to Ken's inbox (NOTIFY_EMAIL_TO).
 */
export const resendConfigured = () => !!process.env.RESEND_API_KEY;

export async function sendDirectEmail(p: { to: string; subject: string; text: string }): Promise<{ id?: string }> {
  const from = process.env.DRIVER_EMAIL_FROM || "Ken Aman <ken@globalrunnerslogistics.com>";
  const replyTo = process.env.RESEND_INBOUND_ADDRESS || process.env.NOTIFY_EMAIL_TO?.split(",")[0]?.trim();
  const footer = "\n\n--\nGlobal Runners Logistics LLC · Henderson, NV\nDon't want these emails? Reply \"stop\" and we won't email you again.";
  const r = await callJson<{ id?: string }>("resend", "https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [p.to], subject: p.subject, text: p.text + footer, ...(replyTo ? { reply_to: replyTo } : {}) }),
    retries: 0,
  });
  return { id: r.id };
}

/** Body of an email received on the Resend inbound address. */
export async function getReceivedEmail(id: string): Promise<{ from: string; subject: string; text: string } | null> {
  const r = await callJson<{ from?: string; subject?: string; text?: string; html?: string }>("resend", `https://api.resend.com/emails/receiving/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  }).catch(() => null);
  if (!r) return null;
  const text = r.text ?? (r.html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return { from: r.from ?? "", subject: r.subject ?? "", text };
}
