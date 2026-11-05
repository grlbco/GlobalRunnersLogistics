import crypto from "node:crypto";
import { after } from "next/server";
import { ingestDirectEmail } from "@/lib/crm/sync";
import { getReceivedEmail } from "@/lib/integrations/resend";

export const maxDuration = 60;

/** Svix signature (Resend webhooks): svix-id, svix-timestamp, svix-signature with RESEND_WEBHOOK_SECRET (whsec_…). */
function verify(raw: string, h: Headers) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const id = h.get("svix-id"), ts = h.get("svix-timestamp"), sig = h.get("svix-signature");
  if (!id || !ts || !sig || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const expected = crypto.createHmac("sha256", Buffer.from(secret.replace(/^whsec_/, ""), "base64")).update(`${id}.${ts}.${raw}`).digest("base64");
  return sig.split(" ").some((p) => {
    const v = p.split(",")[1] ?? "";
    return v.length === expected.length && crypto.timingSafeEqual(Buffer.from(v), Buffer.from(expected));
  });
}

/** Resend inbound: a driver replied to a direct email → CRM timeline + assistant. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verify(raw, req.headers)) return new Response("Bad signature", { status: 401 });
  const body = JSON.parse(raw) as { type?: string; data?: { email_id?: string; id?: string; from?: string; subject?: string } };
  if (body.type !== "email.received") return Response.json({ ok: true, ignored: true });
  const id = body.data?.email_id ?? body.data?.id;
  if (!id) return Response.json({ ok: false }, { status: 400 });
  after(async () => {
    const full = await getReceivedEmail(id);
    if (full) await ingestDirectEmail({ id, from: full.from || body.data?.from || "", subject: full.subject || body.data?.subject || "", text: full.text });
  });
  return Response.json({ ok: true });
}
