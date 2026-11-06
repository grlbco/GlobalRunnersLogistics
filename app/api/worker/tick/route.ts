import { syncAll } from "@/lib/crm/sync";
import { processDue } from "@/lib/crm/outbox";
import { processAgentQueue } from "@/lib/agent/engine";
import { queueAbandonedNudges } from "@/lib/crm/forms";
import { processWorkflows } from "@/lib/automations/engine";
import { maybeSendDigest } from "@/lib/automations/digest";
import { syncCampaignStats } from "@/lib/crm/campaigns";
import { sweepStuck } from "@/lib/agent/rescue";

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
  // One failing step must not stop the others: a sync error shouldn't leave drivers unanswered.
  const errors: Record<string, string> = {};
  const step = async <T,>(name: string, fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch (e) {
      errors[name] = (e instanceof Error ? e.message : String(e)).slice(0, 300);
      console.error(`worker step ${name} failed`, e);
      return null;
    }
  };
  const sync = await step("sync", syncAll);
  const nudges = await step("nudges", queueAbandonedNudges);
  const workflows = await step("workflows", processWorkflows);
  const agent = await step("agent", processAgentQueue);
  const sent = await step("send", processDue);
  const sweep = await step("sweep", sweepStuck);
  const digest = await step("digest", maybeSendDigest);
  const campaigns = await step("campaigns", syncCampaignStats);
  // heartbeat for the go-live checklist (production worker only)
  if (!devLocal) {
    const { adminDb } = await import("@/lib/crm/admin");
    await adminDb().from("app_settings").upsert({ key: "worker", value: { last_tick: new Date().toISOString(), ms: Date.now() - started, errors }, updated_at: new Date().toISOString() }).then(() => {}, () => {});
  }
  return Response.json({ ok: Object.keys(errors).length === 0, errors, ms: Date.now() - started, sync, nudges, workflows, agent, sent, sweep, digest, campaigns }, { headers: { "Cache-Control": "no-store" } });
}

export const GET = run;
export const POST = run;
