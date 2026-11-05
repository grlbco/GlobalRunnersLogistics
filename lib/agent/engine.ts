import "server-only";
import { z } from "zod";
import { adminDb } from "@/lib/crm/admin";
import { activity, moveStage, suppress, type Contact } from "@/lib/crm/ingest";
import { getAssistantSettings } from "@/lib/crm/settings";
import { notifyTeam } from "@/lib/crm/notify";
import { localTime } from "@/lib/crm/timezones";
import { company } from "@/content/facts";
import { chatJson, chatText, extractJson, type ChatMsg } from "@/lib/integrations/deepseek";
import { checkReply } from "./checks";
import { STAGES_AGENT_MAY_SET, buildMessages, type Turn } from "./prompt";

const str = z.preprocess((v) => (v === undefined || v === null ? null : String(v)), z.string().nullable());
const Decision = z.object({
  intent: z.preprocess((v) => (typeof v === "string" ? v : "other"), z.string()),
  replies: z.preprocess((v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()) : typeof v === "string" && v.trim() ? [v] : []), z.array(z.string())).default([]),
  reply: str.optional(),
  subject: str.optional(),
  stage: z.enum(STAGES_AGENT_MAY_SET).nullable().optional().catch(null),
  facts: z.preprocess((v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).filter(([, x]) => ["string", "number", "boolean"].includes(typeof x))) : {}), z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))).default({}),
  summary: str.optional(),
  next_step: str.optional(),
  followup_hours: z.preprocess((v) => (typeof v === "number" ? v : v == null ? null : Number(v) || null), z.number().min(1).max(720).nullable()).optional().catch(null),
  handoff: str.optional(),
  mood: str.optional(),
});
export type Decision = z.infer<typeof Decision>;

// Research: 2-3 texts without a reply max, then slower email nurture; most replies come from follow-ups.
const FOLLOWUP_LADDER_H = [24, 72, 168, 336];
const MAX_TEXT_FOLLOWUPS = 3;
const HUMAN_WORDS = /\b(human|real person|manager|supervisor|lawyer|attorney|sue|lawsuit|complaint|harass|scam|police|report you)\b/i;

/** Moves a follow-up time into a good texting window in the driver's zone: 10-11am or 5-6:30pm, Mon-Sat. */
function inGoodWindow(due: Date, tz: string | null): Date {
  if (!tz) return due;
  const local = (d: Date) => {
    const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "numeric", hour12: false, weekday: "short" }).formatToParts(d);
    return { h: Number(p.find((x) => x.type === "hour")?.value) % 24, m: Number(p.find((x) => x.type === "minute")?.value), wd: p.find((x) => x.type === "weekday")?.value };
  };
  let d = new Date(due);
  for (let i = 0; i < 96; i++) {
    const { h, m, wd } = local(d);
    const mins = h * 60 + m;
    if (wd !== "Sun" && ((mins >= 600 && mins <= 660) || (mins >= 1020 && mins <= 1110))) return new Date(d.getTime() + Math.random() * 20 * 60_000);
    d = new Date(d.getTime() + 15 * 60_000);
  }
  return due;
}
/** Last-mile cleanup so texts read human: no em/en dashes, no semicolons, no wrapping quotes. */
const clean = (t: string) => t.trim().replace(/\s*[—–]\s*/g, ", ").replace(/;\s*/g, ". ").replace(/^["“]|["”]$/g, "").replace(/,\s*,/g, ",").trim();
const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || company.url;

export async function formLinkFor(contactId: string) {
  const db = adminDb();
  const { data: existing } = await db.from("form_links").select("token, sent_at, opened_at, step_reached, completed_at").eq("contact_id", contactId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const row = existing ?? (await db.from("form_links").insert({ contact_id: contactId }).select("token, sent_at, opened_at, step_reached, completed_at").single()).data!;
  return { url: `${siteUrl()}/apply/driver?t=${row.token}`, token: row.token as string, form: { sent: !!row.sent_at, opened: !!row.opened_at, step: row.step_reached ?? 0, completed: !!row.completed_at } };
}

type RunInput = { simTurns?: Turn[]; contactId: string; trigger: "text_received" | "email_received" | "followup" | "form_abandoned" | "manual" | "test"; inputMessageId?: string | null; followupAttempt?: number; runId?: string; dryRunMessage?: { channel: "email" | "sms"; body: string } };
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
      if (input.trigger !== "manual" && c.agent_paused_until && new Date(c.agent_paused_until) > new Date())
        return (await log({ action: "ignored", decision: { reason: "a person replied recently (paused)" } }), { action: "ignored", reason: "Paused: a person replied recently" });
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
    const turns: Turn[] = input.simTurns ?? (msgs ?? []).reverse().map((m) => ({ at: m.created_at, direction: m.direction, channel: m.channel, author: m.author, body: m.body }));
    if (input.dryRunMessage) turns.push({ at: new Date().toISOString(), direction: "inbound", channel: input.dryRunMessage.channel, author: "lead", body: input.dryRunMessage.body });
    const startedAt = Date.now();
    const lastInboundTurn = [...turns].reverse().find((t) => t.direction === "inbound");

    // Hand-off words are caught in code, before the model (asks for a person, legal words, anger).
    if (!dry && lastInboundTurn && input.trigger !== "followup" && HUMAN_WORDS.test(lastInboundTurn.body)) {
      await handoff(c, `Driver wrote: "${lastInboundTurn.body.slice(0, 120)}"`);
      await log({ action: "handed_off", decision: { reason: "hand-off words" } });
      return { action: "handed_off", reason: "hand-off words" };
    }
    // No endless loops: 10+ assistant texts in 7 days without the form → a person takes it from here.
    if (!dry && !input.simTurns) {
      const since7 = new Date(Date.now() - 7 * 86400_000).toISOString();
      const { count: sent7 } = await db.from("messages").select("*", { count: "exact", head: true }).eq("contact_id", c.id).eq("author", "agent").gte("created_at", since7);
      if ((sent7 ?? 0) >= 10) {
        await handoff(c, "Long conversation without the form (10+ assistant texts in 7 days)");
        await log({ action: "handed_off", decision: { reason: "conversation limit" } });
        return { action: "handed_off", reason: "conversation limit" };
      }
    }
    if (link.form.completed && input.trigger !== "test" && input.trigger !== "text_received" && input.trigger !== "email_received")
      return (await log({ action: "ignored", decision: { reason: "form already completed" } }), { action: "ignored", reason: "Form already completed" });

    // Reply on the channel they used; follow-ups prefer text when allowed.
    const lastInbound = [...turns].reverse().find((t) => t.direction === "inbound");
    let channel: "email" | "sms" = (lastInbound?.channel as "email" | "sms") ?? (c.sms_consent ? "sms" : "email");
    if (input.trigger === "followup") channel = c.sms_consent && (input.followupAttempt ?? 1) <= MAX_TEXT_FOLLOWUPS ? "sms" : "email";
    // "Reply now" from staff: answer the driver if they wrote last, otherwise a fresh nudge.
    const promptTrigger = input.trigger === "manual" ? (turns.at(-1)?.direction === "inbound" ? "text_received" : "followup") : input.trigger === "test" ? "text_received" : input.trigger;
    if (channel === "sms" && !c.sms_consent) channel = "email";

    const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || "the driver";
    const base = { name, city: c.city, state: c.state, localTime: localTime(c.timezone), stage: c.stage, channel, smsConsent: c.sms_consent, formUrl: link.url, form: link.form, memory: { facts: (mem?.facts as Record<string, unknown>) ?? {}, summary: mem?.summary, next_step: mem?.next_step }, turns, trigger: promptTrigger, followupAttempt: input.followupAttempt };

    // Decide: JSON first (2 tries with the checker's feedback), then a plain-text fallback so a driver is never left hanging.
    const messages: ChatMsg[] = buildMessages(base);
    let decision: Decision | null = null;
    let problems: string[] = [];
    let raw = "";
    let costUsd = 0, tokensIn = 0, tokensOut = 0, latency = 0, model = "";
    const track = (r: { costUsd: number; tokensIn: number; tokensOut: number; latencyMs: number; model: string }) => {
      costUsd += r.costUsd; tokensIn += r.tokensIn; tokensOut += r.tokensOut; latency += r.latencyMs; model = r.model;
    };
    const partsOf = (d: Decision) => (d.replies.length ? d.replies : d.reply ? [d.reply] : []).map(clean).filter(Boolean).slice(0, channel === "sms" ? 3 : 1);
    for (let attempt = 0; attempt < 2 && !decision; attempt++) {
      const r = await chatJson(messages, { temperature: attempt ? 0.5 : 0.8 });
      track(r);
      raw = r.content;
      let parsed: Decision;
      try {
        parsed = Decision.parse(extractJson(r.content));
      } catch {
        problems = [`invalid JSON (finish: ${r.finish ?? "?"})`];
        messages.push({ role: "assistant", content: r.content.slice(0, 2000) }, { role: "user", content: "[INSTRUCTION] That wasn't valid JSON. Return ONLY the JSON object, nothing else." });
        continue;
      }
      const parts = partsOf(parsed);
      if (!parts.length || parsed.handoff) { decision = parsed; problems = []; break; }
      const bad = parts.flatMap((t) => checkReply(t, { channel, formUrl: link.url }).problems);
      if (!bad.length) { decision = { ...parsed, replies: parts }; problems = []; break; }
      problems = bad;
      messages.push({ role: "assistant", content: r.content.slice(0, 2000) }, { role: "user", content: `[INSTRUCTION] Your texts broke these rules: ${bad.join("; ")}. Rewrite them so every rule is followed. Return the full JSON again.` });
    }
    if (!decision) {
      // Plain-text fallback: just the reply, no JSON.
      const r = await chatText([...buildMessages(base).slice(0, -1), { role: "user", content: `[INSTRUCTION] Reply to their latest message on ${channel}. Write ONLY the message text${channel === "sms" ? " (1-2 short sentences, under 200 characters)" : ""}, nothing else. No em dashes.` }], { temperature: 0.6, maxTokens: 400 });
      track(r);
      const text = clean(r.content.replace(/^["']|["']$/g, ""));
      const check = checkReply(text, { channel, formUrl: link.url });
      if (text && check.ok) decision = { intent: "other", replies: [text], facts: {}, stage: null, followup_hours: null } as Decision;
      else problems = [...problems, ...check.problems.map((x) => `fallback: ${x}`)];
    }
    const meta = { model, tokens_in: tokensIn, tokens_out: tokensOut, cost_usd: costUsd, latency_ms: latency };

    if (dry) return decision ? { action: decision.handoff ? "handed_off" : decision.replies.length ? "would_reply" : "no_reply", reply: decision.replies.join("\n\n"), channel, decision, problems, costUsd } : { action: "failed", problems, costUsd };

    // Freshness: if the driver texted again while we were writing, drop this reply; the next run answers everything.
    if (!dry && !input.simTurns) {
      const { data: newer } = await db.from("messages").select("id").eq("contact_id", c.id).eq("direction", "inbound").gt("created_at", new Date(Math.max(startedAt - 2000, lastInboundTurn ? new Date(lastInboundTurn.at).getTime() + 1 : 0)).toISOString()).limit(1);
      if (newer?.length) {
        await log({ action: "superseded", decision: { reason: "driver texted again while writing" }, ...{ model, tokens_in: tokensIn, tokens_out: tokensOut, cost_usd: costUsd, latency_ms: latency } });
        return { action: "superseded", reason: "newer message" };
      }
    }

    if (!decision) {
      await handoff(c, `Couldn't write a safe reply: ${problems.join("; ")}`);
      await log({ action: "handed_off", checks: { problems, raw: raw.slice(0, 1500) }, ...meta });
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
    const parts = decision.replies;
    if (parts.length) {
      const manual = input.trigger === "manual";
      // Human timing: quick in a live back-and-forth, slower after a long silence; extra texts follow like someone typing.
      const lastOut = [...turns].reverse().find((t) => t.direction === "outbound");
      const live = !!lastOut && Date.now() - new Date(lastOut.at).getTime() < 20 * 60_000;
      const replying = input.trigger === "text_received" || input.trigger === "email_received";
      // Human cadence (GoHighLevel uses ~60-90s for SMS): live chat 30-75s, reply after a silence 60-150s, plus "typing" time.
      const base = manual ? 5 : replying ? (live ? 30 + Math.random() * 45 : 60 + Math.random() * 90) + parts[0].length * 0.25 : settings.delay_min_s + Math.random() * Math.max(0, settings.delay_max_s - settings.delay_min_s);
      let at = Date.now() + 1000 * base;
      await db.from("outbox").update({ status: "cancelled", error: "replaced by a newer reply" }).eq("contact_id", c.id).eq("author", "agent").in("status", ["draft", "pending"]);
      const isReply = input.trigger === "text_received" || input.trigger === "email_received" || manual;
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) at += 1000 * (8 + Math.random() * 12 + parts[i].length * 0.15);
        await db.from("outbox").insert({
          contact_id: c.id, channel, author: "agent", subject: i === 0 ? decision.subject ?? null : null, body: parts[i],
          status: settings.draft_mode ? "draft" : "pending", send_after: new Date(at).toISOString(), is_reply: isReply,
        });
      }
      if (parts.some((t) => t.includes(link.url)) && !link.form.sent) {
        await db.from("form_links").update({ sent_at: new Date().toISOString() }).eq("token", link.token);
        await moveStage(c as Contact, "form_sent", "agent");
      }
      action = settings.draft_mode ? "draft" : "replied";
    }

    // Follow-up ladder: any run resets it.
    await db.from("followups").update({ status: "cancelled" }).eq("contact_id", c.id).eq("status", "pending");
    const attempt = input.trigger === "followup" ? (input.followupAttempt ?? 1) + 1 : 1; // manual/reply resets the ladder
    const done = ["not_interested", "not_fit", "stop", "wrong_person"].includes(decision.intent) || decision.stage === "not_interested" || decision.stage === "not_fit";
    if (!done && !link.form.completed && attempt <= Math.min(settings.max_followups, FOLLOWUP_LADDER_H.length)) {
      const hours = FOLLOWUP_LADDER_H[attempt - 1];
      const fuChannel: "email" | "sms" = c.sms_consent && attempt <= MAX_TEXT_FOLLOWUPS ? "sms" : "email";
      const due = inGoodWindow(new Date(Date.now() + hours * 3600_000), c.timezone);
      await db.from("followups").insert({ contact_id: c.id, due_at: due.toISOString(), attempt, reason: `Follow-up #${attempt} (${fuChannel === "sms" ? "text" : "email"})`, channel: fuChannel });
    }

    await log({ action, decision, reply: parts.join("\n\n") || null, checks: { problems }, ...meta });
    return { action, reply: parts.join("\n\n"), channel, decision, costUsd };
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
    // Trailing-edge debounce: wait until the driver stops sending for 40s, then answer all their texts at once.
    const { data: lastIn } = await db.from("messages").select("created_at").eq("contact_id", q.contact_id).eq("direction", "inbound").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (lastIn && Date.now() - new Date(lastIn.created_at).getTime() < 40_000) continue;
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
