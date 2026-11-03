import { syncAll } from "@/lib/crm/sync";
import { processDue } from "@/lib/crm/outbox";
import { processAgentQueue } from "@/lib/agent/engine";

export const maxDuration = 60;

/**
 * Background tick: pull new emails/texts, then send what's due in the outbox.
 * Production: pg_cron → POST with header `x-worker-secret`. Local dev: the CRM pings it while open.
 */
async function run(req: Request) {
  const devLocal = process.env.NODE_ENV !== "production";
  const ok = req.headers.get("x-worker-secret") === process.env.WORKER_SECRET && !!process.env.WORKER_SECRET;
  if (!ok && !devLocal) return new Response("Unauthorized", { status: 401 });
  const started = Date.now();
  const sync = await syncAll();
  const agent = await processAgentQueue();
  const sent = await processDue();
  return Response.json({ ok: true, ms: Date.now() - started, sync, agent, sent }, { headers: { "Cache-Control": "no-store" } });
}

export const GET = run;
export const POST = run;
