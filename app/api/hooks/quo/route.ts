import { after } from "next/server";
import { adminDb } from "@/lib/crm/admin";
import { logEvent } from "@/lib/crm/ingest";
import { ingestQuoMessage } from "@/lib/crm/sync";
import { parseQuoEvent, verifyQuoSignature } from "@/lib/integrations/quo";

export const maxDuration = 60;

/** Quo webhook: message.received / message.delivered / message.failed. HMAC-verified. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyQuoSignature(raw, req.headers)) return new Response("Bad signature", { status: 401 });
  const body = JSON.parse(raw);
  const { type, message } = parseQuoEvent(body);

  if (message && (type === "message.delivered" || type === "message.failed" || type === "message.undelivered")) {
    await adminDb().from("messages").update(type === "message.delivered" ? { status: "delivered" } : { status: "failed", error: type }).eq("channel", "sms").eq("external_id", message.id);
    return Response.json({ ok: true });
  }
  if (type === "message.received" && message) {
    after(() => ingestQuoMessage(message).then(() => {}));
    return Response.json({ ok: true });
  }
  await logEvent("quo", type || "unknown", body);
  return Response.json({ ok: true, ignored: true });
}
