import { adminDb } from "@/lib/crm/admin";
import { runAgent } from "@/lib/agent/engine";
import { EVAL_CASES, judge } from "@/lib/agent/evalCases";
import { HUMAN_WORDS } from "@/lib/agent/engine";
import { isOptOut } from "@/lib/crm/ingest";
import type { Turn } from "@/lib/agent/prompt";

export const maxDuration = 300;

/**
 * Local-only test set, run through the real model. Dry run: nothing is saved or sent, but it spends AI credit.
 * /api/dev/agent-eval?group=injection runs one group, ?s=name runs one case.
 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const url = new URL(req.url);
  const { data: test } = await adminDb().from("contacts").select("id").contains("tags", ["test"]).limit(1).single();
  if (!test) return Response.json({ error: "Tag one contact \"test\" first" }, { status: 400 });

  const cases = EVAL_CASES.filter((c) => (!url.searchParams.get("group") || c.group === url.searchParams.get("group")) && (!url.searchParams.get("s") || c.name === url.searchParams.get("s")));
  const results: { name: string; group: string; pass: boolean; problems: string[]; reply: string }[] = [];
  let cost = 0;
  for (const c of cases) {
    const turns: Turn[] = [{ at: new Date(Date.now() - 3600_000).toISOString(), direction: "outbound", channel: "email", author: "campaign", body: "Hi, this is the recruiting team at Global Runners Logistics in Las Vegas. We're hiring CDL-A drivers out of Henderson." }];
    let last = { reply: "", handoff: false, stops: false, failed: false };
    for (const line of c.driver) {
      turns.push({ at: new Date().toISOString(), direction: "inbound", channel: "sms", author: "lead", body: line });
      const r = await runAgent({ contactId: test.id, trigger: "test", simTurns: [...turns] });
      cost += r.costUsd ?? 0;
      const d = r.decision;
      last = {
        reply: (d?.replies ?? []).join("\n"),
        // The same checks the live path runs before the AI: code catches these first.
        handoff: !!d?.handoff || HUMAN_WORDS.test(line),
        stops: isOptOut(line) || d?.intent === "stop" || d?.intent === "not_interested" || d?.stage === "not_interested",
        failed: r.action === "failed",
      };
      for (const t of d?.replies ?? []) turns.push({ at: new Date().toISOString(), direction: "outbound", channel: "sms", author: "agent", body: t });
    }
    const problems = judge(c, last);
    results.push({ name: c.name, group: c.group, pass: !problems.length, problems, reply: last.reply.slice(0, 400) });
  }
  const passed = results.filter((r) => r.pass).length;
  return Response.json({ passed, total: results.length, cost: Number(cost.toFixed(4)), failures: results.filter((r) => !r.pass), results }, { headers: { "Cache-Control": "no-store" } });
}
