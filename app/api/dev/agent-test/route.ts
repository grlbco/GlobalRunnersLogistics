import { adminDb } from "@/lib/crm/admin";
import { formLinkFor, runAgent } from "@/lib/agent/engine";
import type { Turn } from "@/lib/agent/prompt";

export const maxDuration = 300;

/** Local-only: plays scripted driver conversations through the real model (dry run, nothing saved or sent). */
const SCENARIOS: Record<string, string[]> = {
  interested: ["hey got your email, what kind of job is it", "ok how much does it pay", "sounds good, I have 6 years OTR, how do I apply"],
  skeptical: ["is this a real company?", "every company says that. why would I leave mine", "ok whats the home time like"],
  spanish: ["hola, me interesa. puedo llevar a mi perro?", "y cuanto pagan?"],
  not_fit: ["I just got my CDL last month, can I still apply?"],
  not_interested: ["not interested thanks"],
  bot: ["am I talking to a bot?"],
  owner_op: ["I have my own truck, do you take owner operators?"],
  stop: ["STOP"],
};

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const only = new URL(req.url).searchParams.get("s");
  const { data: test } = await adminDb().from("contacts").select("id").contains("tags", ["test"]).limit(1).single();
  if (!test) return Response.json({ error: "no test contact" }, { status: 400 });
  const out: Record<string, { transcript: string[]; problems: string[]; cost: number }> = {};
  for (const [name, lines] of Object.entries(SCENARIOS)) {
    if (only && only !== name) continue;
    const turns: Turn[] = [{ at: new Date(Date.now() - 3600_000).toISOString(), direction: "outbound", channel: "email", author: "campaign", body: "Hi George, Ken here, owner of Global Runners Logistics in Las Vegas. We're hiring CDL-A drivers out of Henderson. Worth a quick call this week?" }];
    const transcript: string[] = [];
    const problems: string[] = [];
    let cost = 0;
    for (const line of lines) {
      turns.push({ at: new Date().toISOString(), direction: "inbound", channel: "sms", author: "lead", body: line });
      transcript.push(`DRIVER: ${line}`);
      const r = await runAgent({ contactId: test.id, trigger: "test", simTurns: [...turns] });
      cost += r.costUsd ?? 0;
      if (r.problems?.length) problems.push(...r.problems);
      const parts = (r.decision?.replies ?? []) as string[];
      if (!parts.length) transcript.push(`  → (${r.action}${r.decision?.handoff ? `: handoff "${r.decision.handoff}"` : ""}${r.decision?.intent ? `, intent ${r.decision.intent}` : ""}${r.decision?.stage ? `, stage ${r.decision.stage}` : ""})`);
      for (const t of parts) {
        transcript.push(`US: ${t}`);
        turns.push({ at: new Date().toISOString(), direction: "outbound", channel: "sms", author: "agent", body: t });
      }
    }
    out[name] = { transcript, problems, cost: Number(cost.toFixed(4)) };
  }
  // The form chase: driver asked for the form, got the link, went quiet. Plays every follow-up in order.
  if (!only || only === "chase") {
    const form = (await formLinkFor(test.id)).url;
    const turns: Turn[] = [
      { at: new Date(Date.now() - 3 * 3600_000).toISOString(), direction: "inbound", channel: "sms", author: "lead", body: "ok send me the application, I have 4 years otr" },
      { at: new Date(Date.now() - 3 * 3600_000).toISOString(), direction: "outbound", channel: "sms", author: "agent", body: `4 years is solid. Here's the form, takes about 5 min: ${form}` },
    ];
    const plan: { kind: "chase" | "chase_extra" | "nurture"; n: number; ch: "sms" | "email" }[] = [
      { kind: "chase", n: 1, ch: "sms" }, { kind: "chase_extra", n: 1, ch: "email" }, { kind: "chase", n: 2, ch: "sms" }, { kind: "chase", n: 3, ch: "email" },
      { kind: "chase", n: 4, ch: "sms" }, { kind: "chase", n: 5, ch: "email" }, { kind: "chase", n: 6, ch: "sms" }, { kind: "chase", n: 7, ch: "email" },
      { kind: "chase", n: 8, ch: "sms" }, { kind: "nurture", n: 1, ch: "email" },
    ];
    const transcript: string[] = [];
    const problems: string[] = [];
    let cost = 0;
    for (const step of plan) {
      const r = await runAgent({ contactId: test.id, trigger: "followup", followupKind: step.kind, followupAttempt: step.n, followupChannel: step.ch, simTurns: [...turns] });
      cost += r.costUsd ?? 0;
      if (r.problems?.length) problems.push(...r.problems);
      const parts = (r.decision?.replies ?? []) as string[];
      const label = `${step.kind} #${step.n} (${r.channel ?? step.ch})`;
      if (!parts.length) transcript.push(`${label}: (${r.action})`);
      for (const t of parts) {
        transcript.push(`${label}${r.decision?.subject ? ` [${r.decision.subject}]` : ""}: ${t}`);
        turns.push({ at: new Date().toISOString(), direction: "outbound", channel: r.channel ?? step.ch, author: "agent", body: t });
      }
    }
    out.chase = { transcript, problems, cost: Number(cost.toFixed(4)) };
  }
  return Response.json(out, { headers: { "Cache-Control": "no-store" } });
}
