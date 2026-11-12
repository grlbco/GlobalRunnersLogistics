import { z } from "zod";

export const maxDuration = 300;

const body = z.object({
  campaignId: z.string().uuid(),
  tiers: z.array(z.number().int().min(1).max(5)).default([1, 2, 3, 4, 5]),
  states: z.array(z.string().length(2)).default([]),
  count: z.number().int().min(1).max(5000),
});

/**
 * Adds the next wave of contacts to a CRM campaign that is linked to Instantly (same rules as the
 * "Add leads" button: consent, suppressions, stage new, never in another campaign).
 * Auth: header `x-worker-secret` = WORKER_SECRET. For operators/scripts; staff use the CRM button.
 */
export async function POST(req: Request) {
  const secret = process.env.WORKER_SECRET;
  if (!secret || req.headers.get("x-worker-secret") !== secret) return new Response("Unauthorized", { status: 401 });
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ ok: false, error: p.error.issues[0]?.message }, { status: 400 });
  const { addWave } = await import("@/lib/crm/campaigns");
  try {
    const added = await addWave(p.data.campaignId, { tiers: p.data.tiers, states: p.data.states, count: p.data.count });
    return Response.json({ ok: true, added });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
