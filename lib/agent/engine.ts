import "server-only";
import { z } from "zod";
import { adminDb } from "@/lib/crm/admin";
import { activity, moveStage, suppress, type Contact } from "@/lib/crm/ingest";
import { getAssistantSettings } from "@/lib/crm/settings";
import { notifyTeam } from "@/lib/crm/notify";
import { localTime } from "@/lib/crm/timezones";
import { company } from "@/content/facts";
import { chatJson, type ChatMsg } from "@/lib/integrations/deepseek";
import { checkReply } from "./checks";
import { STAGES_AGENT_MAY_SET, systemPrompt, userPrompt, type Turn } from "./prompt";

const Decision = z.object({
  intent: z.string().default("other"),
  reply: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  stage: z.enum(STAGES_AGENT_MAY_SET).nullable().optional().catch(null),
  facts: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional().catch({}),
  summary: z.string().nullable().optional(),
  next_step: z.string().nullable().optional(),
  followup_hours: z.number().min(1).max(720).nullable().optional().catch(null),
  handoff: z.string().nullable().optional(),
  mood: z.string().nullable().optional(),
});
export type Decision = z.infer<typeof Decision>;

const FOLLOWUP_LADDER_H = [20, 48, 96, 168, 336];
const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || company.url;

export async function formLinkFor(contactId: string) {
  const db = adminDb();
  const { data: existing } = await db.from("form_links").select("token, sent_at, opened_at, step_reached, completed_at").eq("contact_id", contactId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const row = existing ?? (await db.from("form_links").insert({ contact_id: contactId }).select("token, sent_at, opened_at, step_reached, completed_at").single()).data!;
  return { url: `${siteUrl()}/apply/driver?t=${row.token}`, token: row.token as string, form: { sent: !!row.sent_at, opened: !!row.opened_at, step: row.step_reached ?? 0, completed: !!row.completed_at } };
}

type RunInput = { contactId: string; trigger: "text_received" | "email_received" | "followup" | "form_abandoned" | "test"; inputMessageId?: string | null; followupAttempt?: number; runId?: string; dryRunMessage?: { channel: "email" | "sms"; body: string } };
export type RunResult = { action: string; reply?: string | null; channel?: "email" | "sms"; decision?: Decision; problems?: string[]; reason?: string; costUsd?: number };

/** One assistant decision for one driver. Never throws: failures hand the driver to a person. */
export async function runAgent(input: RunInput): Promise<RunResult> {
  const db = adminDb();
  const dry = input.trigger === "test";
  const log = async (patch: Record<string, unknown>) => {
    if (dry) return;
    if (input.runId) await db.from("agent_runs").update(patch).eq("id", input.runId);
    else await db.from("agent_runs").insert({ contact_id: input.contactId, trigger: input.trigger, input_message_id: input.inputMessageId ?? null, ...patch });
  };

  try {
    const settings = await getAssistantSettings();
    const { data: c } = await db.from("contacts").select("*").eq("id", input.contactId).single();
    if (!c) return { action: "ignored", reason: "contact not found" };
    if (!dry) {
      if (!settings.enabled) return (await log({ action: "ignored", decision: { reason: "assistant is off" } }), { action: "ignored", reason: "Assistant is off" });
      if (c.agent_mode !== "auto") return (await log({ action: "ignored", decision: { reason: "manual" } }), { action: "ignored", reason: "A person is handling this driver" });
      if (c.do_not_contact) return (await log({ action: "ignored", decision: { reason: "do not contact" } }), { action: "ignored", reason: "Do not contact" });
      const since = new Date(Date.now() - 86400_000).toISOString();
      const { count } = await db.from("outbox").select("*", { count: "exact", head: true }).eq("contact_id", c.id).eq("author", "agent").gte("created_at", since).neq("status", "cancelled");
      if ((count ?? 0) >= settings.max_per_day) return (await log({ action: "ignored", decision: { reason: "daily limit" } }), { action: "ignored", reason: "Daily message limit reached for this driver" });
    }

    // Context
    const [{ data: msgs }, { data: mem }, link] = await Promise.all([
      db.from("messages").select("created_at, direction, channel, author, body").eq("contact_id", c.id).neq("channel", "call").order("created_at", { ascending: false }).limit(16),
      db.from("agent_memory").select("facts, summary, next_step").eq("contact_id", c.id).maybeSingle(),
      formLinkFor(c.id),
    ]);
    const turns: Turn[] = (msgs ?? []).reverse().map((m) => ({ at: m.created_at, direction: m.direction, channel: m.channel, author: m.author, body: m.body }));
    if (input.dryRunMessage) turns.push({ at: new Date().toISOString(), direction: "inbound", channel: input.dryRunMessage.channel, author: "lead", body: input.dryRunMessage.body });
    if (link.form.completed && input.trigger !== "test" && input.trigger !== "text_received" && input.trigger !== "email_received")
      return (await log({ action: "ignored", decision: { reason: "form already completed" } }), { action: "ignored", reason: "Form already completed" });

    // Reply on the channel they used; follow-ups prefer text when allowed.
    const lastInbound = [...turns].reverse().find((t) => t.direction === "inbound");
    let channel: "email" | "sms" = (lastInbound?.channel as "email" | "sms") ?? (c.sms_consent ? "sms" : "email");
    if (input.trigger === "followup" && c.sms_consent && (input.followupAttempt ?? 1) % 2 === 0) channel = "sms";
    if (channel === "sms" && !c.sms_consent) channel = "email";

    const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || "the driver";
    const base = { name, city: c.city, state: c.state, localTime: localTime(c.timezone), stage: c.stage, channel, smsConsent: c.sms_consent, formUrl: link.url, form: link.form, memory: { facts: (mem?.facts as Record<string, unknown>) ?? {}, summary: mem?.summary, next_step: mem?.next_step }, turns, trigger: input.trigger === "test" ? "text_received" : input.trigger, followupAttempt: input.followupAttempt };

    // Decide (one retry with the checker's feedback)
    const messages: ChatMsg[] = [{ role: "system", content: systemPrompt() }, { role: "user", content: userPrompt(base) }];
    let decision: Decision | null = null;
    let problems: string[] = [];
    let costUsd = 0, tokensIn = 0, tokensOut = 0, latency = 0, model = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await chatJson(messages);
      costUsd += r.costUsd; tokensIn += r.tokensIn; tokensOut += r.tokensOut; latency += r.latencyMs; model = r.model;
      let parsed: Decision;
      try {
        parsed = Decision.parse(JSON.parse(r.content));
      } catch {
        problems = ["model returned invalid JSON"];
        messages.push({ role: "assistant", content: r.content }, { role: "user", content: "That was not valid JSON in the required shape. Return only the JSON object." });
        continue;
      }
      decision = parsed;
      if (!parsed.reply || parsed.handoff) { problems = []; break; }
      const check = checkReply(parsed.reply, { channel, formUrl: link.url });
      problems = check.problems;
      if (check.ok) break;
      messages.push({ role: "assistant", content: r.content }, { role: "user", content: `Your reply broke these rules: ${check.problems.join("; ")}. Rewrite it to follow every rule. Return the full JSON again.` });
      decision = null;
    }
    const meta = { model, tokens_in: tokensIn, tokens_out: tokensOut, cost_usd: costUsd, latency_ms: latency };

    if (dry) return decision ? { action: decision.handoff ? "handed_off" : decision.reply ? "would_reply" : "no_reply", reply: decision.reply, channel, decision, problems, costUsd } : { action: "failed", problems, costUsd };

    if (!decision) {
      await handoff(c, `Reply failed checks: ${problems.join("; ")}`);
      await log({ action: "handed_off", checks: { problems }, ...meta });
      return { action: "handed_off", problems, costUsd };
    }

    // Memory
    const facts = { ...((mem?.facts as Record<string, unknown>) ?? {}), ...(decision.facts ?? {}) };
    await db.from("agent_memory").upsert({ contact_id: c.id, facts, summary: decision.summary ?? mem?.summary ?? null, next_step: decision.next_step ?? null, mood: decision.mood ?? null, updated_at: new Date().toISOString() });

    // Stop / wrong person
    if (decision.intent === "stop") {
      await suppress(c as Contact, channel, channel === "sms" ? "stop" : "unsubscribe");
      await moveStage(c as Contact, "unsubscribed", "agent");
      await log({ action: "unsubscribed", decision, ...meta });
      return { action: "unsubscribed", decision };
    }
    if (decision.intent === "wrong_person") {
      await suppress(c as Contact, channel, "wrong_person");
      await moveStage(c as Contact, "not_fit", "agent");
    }
    if (decision.stage) await moveStage(c as Contact, decision.stage, "agent");

    if (decision.handoff) {
      await handoff(c, decision.handoff);
      await log({ action: "handed_off", decision, ...meta });
      return { action: "handed_off", decision, reason: decision.handoff };
    }

    let action = "no_reply";
    if (decision.reply) {
      const delay = settings.delay_min_s + Math.random() * Math.max(0, settings.delay_max_s - settings.delay_min_s);
      await db.from("outbox").insert({
        contact_id: c.id, channel, author: "agent", subject: decision.subject ?? null, body: decision.reply.trim(),
        status: settings.draft_mode ? "draft" : "pending", send_after: new Date(Date.now() + delay * 1000).toISOString(),
      });
      if (decision.reply.includes(link.url) && !link.form.sent) {
        await db.from("form_links").update({ sent_at: new Date().toISOString() }).eq("token", link.token);
        await moveStage(c as Contact, "form_sent", "agent");
      }
      action = settings.draft_mode ? "draft" : "replied";
    }

    // Follow-up ladder: any run resets it.
    await db.from("followups").update({ status: "cancelled" }).eq("contact_id", c.id).eq("status", "pending");
    const attempt = input.trigger === "followup" ? (input.followupAttempt ?? 1) + 1 : 1;
    if (!link.form.completed && attempt <= settings.max_followups) {
      const hours = decision.followup_hours ?? FOLLOWUP_LADDER_H[Math.min(attempt - 1, FOLLOWUP_LADDER_H.length - 1)];
      await db.from("followups").insert({ contact_id: c.id, due_at: new Date(Date.now() + hours * 3600_000).toISOString(), attempt, reason: `Follow-up #${attempt}`, channel });
    }

    await log({ action, decision, reply: decision.reply ?? null, checks: { problems }, ...meta });
    return { action, reply: decision.reply, channel, decision, costUsd };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    await log({ action: "failed", decision: { error: reason.slice(0, 500) } }).catch(() => {});
    return { action: "failed", reason };
  }
}

async function handoff(c: { id: string; first_name: string | null; last_name: string | null }, reason: string) {
  const db = adminDb();
  await db.from("contacts").update({ agent_mode: "manual" }).eq("id", c.id);
  await db.from("tasks").insert({ contact_id: c.id, title: `Reply to driver: ${reason}`.slice(0, 300), created_by: "agent", due_at: new Date(Date.now() + 3600_000).toISOString() });
  await activity(c.id, "handed_to_person", { reason }, "agent");
  await notifyTeam(`Driver needs a person: ${[c.first_name, c.last_name].filter(Boolean).join(" ") || "unknown"}`, `${reason}\n\nOpen: ${siteUrl()}/crm/contacts/${c.id}`);
}

/** Worker: queued runs (new inbound messages) + due follow-ups. */
export async function processAgentQueue(limit = 10) {
  const db = adminDb();
  const out: { contactId: string; action: string }[] = [];
  const { data: queued } = await db.from("agent_runs").select("id, contact_id, trigger, input_message_id").eq("action", "queued").order("created_at").limit(limit);
  // Collapse several new messages from one driver into one run (answer the latest).
  const seen = new Set<string>();
  for (const q of queued ?? []) {
    if (seen.has(q.contact_id)) {
      await db.from("agent_runs").update({ action: "merged" }).eq("id", q.id);
      continue;
    }
    seen.add(q.contact_id);
    await db.from("agent_runs").update({ action: "running" }).eq("id", q.id);
    const r = await runAgent({ contactId: q.contact_id, trigger: q.trigger as RunInput["trigger"], inputMessageId: q.input_message_id, runId: q.id });
    out.push({ contactId: q.contact_id, action: r.action });
  }
  const { data: due } = await db.from("followups").select("id, contact_id, attempt").eq("status", "pending").lte("due_at", new Date().toISOString()).order("due_at").limit(limit);
  for (const f of due ?? []) {
    await db.from("followups").update({ status: "done" }).eq("id", f.id);
    const r = await runAgent({ contactId: f.contact_id, trigger: "followup", followupAttempt: f.attempt });
    out.push({ contactId: f.contact_id, action: `followup:${r.action}` });
  }
  return out;
}
