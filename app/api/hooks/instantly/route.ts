import { after } from "next/server";
import { handleInstantlyStatus, syncInstantly } from "@/lib/crm/sync";

export const maxDuration = 60;

/** Instantly webhook (all events). Auth: `x-webhook-secret` header or `?key=` matching INSTANTLY_WEBHOOK_SECRET. */
export async function POST(req: Request) {
  const secret = process.env.INSTANTLY_WEBHOOK_SECRET;
  const given = req.headers.get("x-webhook-secret") ?? new URL(req.url).searchParams.get("key");
  if (!secret || given !== secret) return new Response("Unauthorized", { status: 401 });
  const event = (await req.json()) as { event_type?: string; lead_email?: string; timestamp?: string };
  if (!event?.event_type) return Response.json({ ok: true, ignored: true });

  after(async () => {
    if (event.event_type === "reply_received" || event.event_type === "auto_reply_received") {
      // Pull the actual email (full body + ids) for this lead so it's stored exactly once.
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      await syncInstantly(since, event.lead_email);
    } else {
      await handleInstantlyStatus(event as { event_type: string; lead_email?: string });
    }
  });
  return Response.json({ ok: true });
}
