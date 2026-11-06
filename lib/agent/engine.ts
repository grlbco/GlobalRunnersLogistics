import "server-only";
import { z } from "zod";
import { adminDb } from "@/lib/crm/admin";
import { activity, moveStage, suppress, type Contact } from "@/lib/crm/ingest";
import { getAssistantSettings } from "@/lib/crm/settings";
import { notifyTeam } from "@/lib/crm/notify";
import { sendTelegram, esc } from "@/lib/integrations/telegram";
import { localTime } from "@/lib/crm/timezones";
import { company } from "@/content/facts";
import { chatJson, chatText, extractJson, type ChatMsg } from "@/lib/integrations/deepseek";
import { checkReply } from "./checks";
import { STAGES_AGENT_MAY_SET, buildMessages, type Turn } from "./prompt";
import { FIXED_REPEAT_REASON, fixedAnswer, withDisclosure } from "./fixed";
import { FOLLOWUP_LEASE_MS, MAX_TRIES, failureKind } from "./recovery";
import { REPLY_WINDOW_MS } from "@/lib/crm/sendGate";
import { escalateToPerson } from "./rescue";

const str = z.preprocess((v) => (v === undefined || v === null ? null : String(v)), z.string().nullable());
// Models sometimes put an email body under "body"/"email"/"message": fold those into replies.
const foldBody = (v: unknown) => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return v;
  const o = v as Record<string, unknown>;
  const has = Array.isArray(o.replies) ? o.replies.some((x) => typeof x === "string" && x.trim()) : typeof o.replies === "string" && o.replies.trim();
  if (has) return o;
  const alt = [o.body, o.email, o.email_body, o.message, o.text].find((x) => typeof x === "string" && x.trim());
  return alt ? { ...o, replies: [alt] } : o;
};
const Decision = z.preprocess(foldBody, z.object({
  intent: z.preprocess((v) => (typeof v === "string" ? v : "other"), z.string()),
  replies: z.preprocess((v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()) : typeof v === "string" && v.trim() ? [v] : []), z.array(z.string())).default([]),
  reply: str.optional(),
  subject: str.optional(),
  stage: z.enum(STAGES_AGENT_MAY_SET).nullable().optional().catch(null),
  stage_quote: str.optional(),
  facts: z.preprocess((v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).filter(([, x]) => ["string", "number", "boolean"].includes(typeof x))) : {}), z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))).default({}),
  summary: str.optional(),
  next_step: str.optional(),
  followup_hours: z.preprocess((v) => (typeof v === "number" ? v : v == null ? null : Number(v) || null), z.number().min(1).max(720).nullable()).optional().catch(null),
  handoff: str.optional(),
  mood: str.optional(),
  sms_replies: z.preprocess((v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()) : typeof v === "string" && v.trim() ? [v] : []), z.array(z.string())).default([]),
}));
export type Decision = z.infer<typeof Decision>;

// Before the form link is out: a light ladder (most replies come from follow-ups, 3-day median gaps).
const FOLLOWUP_LADDER_H = [24, 72, 168, 336];
const MAX_TEXT_FOLLOWUPS = 3;
/**
 * After the form link is out: the chase. Drivers can be behind the wheel 11 hours in a 14-hour day, so daytime
 * silence means little and there's no same-day nudge. A text where allowed, otherwise email. It stops the second
 * they fill it in or reply, then a rare check-in. A starting schedule to test in the pilot, not a proven one.
 */
type ChaseStep = { gapH: number; ch: "any" | "email" };
const CHASE: ChaseStep[] = [
  { gapH: 24, ch: "any" },    // next day
  { gapH: 48, ch: "any" },    // day 3
  { gapH: 72, ch: "email" },  // day 6
  { gapH: 168, ch: "email" }, // day 13: last one
];
const NURTURE_GAP_H = 90 * 24;
const NURTURE_MAX = 2;
export type FollowupKind = "nudge" | "chase" | "chase_extra" | "nurture";
// Asking for a person, legal words, threats. ("are you human?" / "is this a scam?" get an honest answer instead.)
export const HUMAN_WORDS = /\b((talk|speak|chat)\s+(to|with)\s+(a\s+|an\s+)?(real\s+)?(person|human|manager|supervisor|someone|recruiter)|manager|supervisor|lawyer|attorney|sue you|lawsuit|complaint|harass\w*|police|report you)\b/i;

/** Moves a follow-up time into a good texting window in the driver's zone: 10-11am or 5-6:30pm, Mon-Sat. */
export function inGoodWindow(due: Date, tz: string | null): Date {
  tz ??= "America/Chicago"; // unknown zone: Central keeps 10–11am / 5–6:30pm reasonable coast to coast
  const local = (d: Date) => {
    const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "numeric", hour12: false, weekday: "short" }).formatToParts(d);
    return { h: Number(p.find((x) => x.type === "hour")?.value) % 24, m: Number(p.find((x) => x.type === "minute")?.value), wd: p.find((x) => x.type === "weekday")?.value };
  };
  let d = new Date(due);
  for (let i = 0; i < 96 * 3; i++) { // up to 3 days ahead (Saturday evening → Monday morning)
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

type RunInput = { simTurns?: Turn[]; contactId: string; trigger: "text_received" | "email_received" | "followup" | "form_abandoned" | "form_submitted" | "interest_label" | "manual" | "test"; formSubmitted?: { form: string; sendDriverForm?: boolean }; inputMessageId?: string | null; followupAttempt?: number; followupKind?: FollowupKind; followupChannel?: "email" | "sms" | null; runId?: string; dryRunMessage?: { channel: "email" | "sms"; body: string } };
export type RunResult = { action: string; retryable?: boolean; reply?: string | null; channel?: "email" | "sms"; decision?: Decision; problems?: string[]; reason?: string; costUsd?: number };

/** One assistant decision for one driver. Never throws: failures come back as "failed", and the worker retries or gets a person. */
export async function runAgent(input: RunInput): Promise<RunResult> {
  const db = adminDb();
  const dry = input.trigger === "test" || !!input.simTurns; // harness runs never write or send
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
      const driverWrote = input.trigger === "text_received" || input.trigger === "email_received";
      const tellHandler = async () => {
        if (!driverWrote) return;
        const title = `Driver replied while you were handling: ${[c.first_name, c.last_name].filter(Boolean).join(" ") || "driver"}`;
        const { count: open } = await db.from("tasks").select("*", { count: "exact", head: true }).eq("contact_id", c.id).is("done_at", null).eq("title", title);
        if (!open) await db.from("tasks").insert({ contact_id: c.id, title, due_at: new Date().toISOString(), created_by: "agent" });
      };
      if (c.agent_mode !== "auto") {
        await tellHandler();
        return (await log({ action: "ignored", decision: { reason: "manual" } }), { action: "ignored", reason: "A person is handling this driver" });
      }
      if (c.do_not_contact) return (await log({ action: "ignored", decision: { reason: "do not contact" } }), { action: "ignored", reason: "Do not contact" });
      if (input.trigger !== "manual" && c.agent_paused_until && new Date(c.agent_paused_until) > new Date()) {
        await tellHandler();
        return (await log({ action: "ignored", decision: { reason: "a person replied recently (paused)" } }), { action: "ignored", reason: "Paused: a person replied recently" });
      }
      // 5) monthly AI budget
      const cap = Number(process.env.DEEPSEEK_MONTHLY_CAP_USD ?? 0);
      if (cap > 0) {
        const month = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        const { data: spent } = await db.from("agent_runs").select("cost_usd").gte("created_at", month).limit(50000);
        const total = (spent ?? []).reduce((t, r) => t + Number(r.cost_usd ?? 0), 0);
        if (total >= cap) {
          const { count: warned } = await db.from("agent_runs").select("*", { count: "exact", head: true }).eq("action", "budget_cap").gte("created_at", month);
          if (!warned) await sendTelegram(`💸 <b>Assistant paused:</b> this month's AI budget ($${cap}) is used up ($${total.toFixed(2)}). Drivers who write now go to the team as tasks. Raise DEEPSEEK_MONTHLY_CAP_USD to resume.`);
          if (input.trigger === "text_received" || input.trigger === "email_received" || input.trigger === "form_submitted")
            await db.from("tasks").insert({ contact_id: c.id, title: `Reply to driver (AI budget used up): ${[c.first_name, c.last_name].filter(Boolean).join(" ") || "driver"}`, due_at: new Date().toISOString(), created_by: "agent" });
          return (await log({ action: "budget_cap", decision: { reason: `monthly AI budget $${cap} used` } }), { action: "ignored", reason: "Monthly AI budget used up" });
        }
      }
      const since = new Date(Date.now() - 86400_000).toISOString();
      // Daily cap is for messages we start (follow-ups). Answering a driver who wrote is never capped.
      const proactive = input.trigger === "followup" || input.trigger === "form_abandoned" || input.trigger === "interest_label";
      const { count } = proactive ? await db.from("outbox").select("*", { count: "exact", head: true }).eq("contact_id", c.id).eq("author", "agent").eq("is_reply", false).gte("created_at", since).neq("status", "cancelled") : { count: 0 };
      if (proactive && (count ?? 0) >= Math.max(settings.max_per_day, 4)) return (await log({ action: "ignored", decision: { reason: "daily limit" } }), { action: "ignored", reason: "Daily message limit reached for this driver" });
    }

    // Context
    const [{ data: msgs }, { data: mem }, link] = await Promise.all([
      db.from("messages").select("created_at, direction, channel, author, body").eq("contact_id", c.id).neq("channel", "call").order("created_at", { ascending: false }).limit(16),
      db.from("agent_memory").select("facts, summary, next_step").eq("contact_id", c.id).maybeSingle(),
      formLinkFor(c.id),
    ]);
    const turns: Turn[] = input.simTurns ?? (msgs ?? []).reverse().map((m) => ({ at: m.created_at, direction: m.direction, channel: m.channel, author: m.author, body: m.body }));
    if (input.dryRunMessage) turns.push({ at: new Date().toISOString(), direction: "inbound", channel: input.dryRunMessage.channel, author: "lead", body: input.dryRunMessage.body });
    // A form submission is the driver's latest action: put it in the conversation so the reply is about it.
    if (!input.simTurns) {
      const { data: sub } = await db.from("crm_form_submissions").select("data, created_at, form:crm_forms(name, schema)").eq("contact_id", input.contactId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (sub && (input.trigger === "form_submitted" || Date.now() - new Date(sub.created_at).getTime() < 3 * 3600_000)) {
        const f = sub.form as unknown as { name: string; schema: { pages: { fields: { id: string; label: string; type: string }[] }[] } } | null;
        const qa = (f?.schema.pages ?? []).flatMap((p) => p.fields).filter((x) => x.type !== "statement" && x.type !== "consent").map((x) => { const v = (sub.data as Record<string, unknown>)[x.id]; return v == null || v === "" ? null : `${x.label} ${Array.isArray(v) ? v.join(", ") : String(v)}`; }).filter(Boolean).join("; ");
        turns.push({ at: sub.created_at, direction: "inbound", channel: "sms", author: "lead", body: `[filled out the "${f?.name ?? "web"}" form: ${qa}]` });
        turns.sort((x, y) => x.at.localeCompare(y.at));
      }
    }
    const startedAt = Date.now();
    const lastInboundTurn = [...turns].reverse().find((t) => t.direction === "inbound");

    // Hand-off words are caught in code, before the model (asks for a person, legal words, anger).
    if (!dry && lastInboundTurn && input.trigger !== "followup" && HUMAN_WORDS.test(lastInboundTurn.body)) {
      await handoff(c, `Driver wrote: "${lastInboundTurn.body.slice(0, 120)}"`);
      await log({ action: "handed_off", decision: { reason: "hand-off words" } });
      return { action: "handed_off", reason: "hand-off words" };
    }
    // No endless loops: 14+ assistant messages in 7 days while the driver keeps talking but never fills the form → a person takes it.
    if (!dry && !input.simTurns && (input.trigger === "text_received" || input.trigger === "email_received")) {
      const since7 = new Date(Date.now() - 7 * 86400_000).toISOString();
      const { count: sent7 } = await db.from("messages").select("*", { count: "exact", head: true }).eq("contact_id", c.id).eq("author", "agent").gte("created_at", since7);
      if ((sent7 ?? 0) >= 14) {
        await handoff(c, "Long conversation without the form (14+ assistant messages in 7 days)");
        await log({ action: "handed_off", decision: { reason: "conversation limit" } });
        return { action: "handed_off", reason: "conversation limit" };
      }
    }
    if (link.form.completed && input.trigger !== "test" && input.trigger !== "text_received" && input.trigger !== "email_received" && input.trigger !== "form_submitted")
      return (await log({ action: "ignored", decision: { reason: "form already completed" } }), { action: "ignored", reason: "Form already completed" });

    // Reply on the channel they used; follow-ups prefer text when allowed.
    const lastInbound = [...turns].reverse().find((t) => t.direction === "inbound");
    let channel: "email" | "sms" = (lastInbound?.channel as "email" | "sms") ?? (c.sms_consent ? "sms" : "email");
    if (input.trigger === "form_submitted") channel = c.sms_consent ? "sms" : "email";
    if (input.trigger === "followup") channel = input.followupChannel ?? (c.sms_consent && (input.followupAttempt ?? 1) <= MAX_TEXT_FOLLOWUPS ? "sms" : "email");
    if (channel === "email" && !(c.email && (dry || (await canEmailContact(c.id))))) channel = "sms";
    // Driver answered an email and we may text them: send a short text too (multi-channel, like a recruiter would).
    let alsoText = false;
    if (!dry && input.trigger === "email_received" && c.sms_consent && (c.cell_phone || c.phone)) {
      const { count: recentSms } = await db.from("messages").select("*", { count: "exact", head: true }).eq("contact_id", c.id).eq("channel", "sms").eq("direction", "outbound").gte("created_at", new Date(Date.now() - 12 * 3600_000).toISOString());
      alsoText = !recentSms;
    }
    // "Reply now" from staff: answer the driver if they wrote last, otherwise a fresh nudge.
    const driverWroteLast = turns.at(-1)?.direction === "inbound";
    const promptTrigger = input.trigger === "manual" ? (driverWroteLast ? "text_received" : "followup") : input.trigger === "test" ? "text_received" : input.trigger === "interest_label" && driverWroteLast ? "text_received" : input.trigger;
    // Someone who just texted us may be answered in that conversation. Anything beyond that needs a recorded yes.
    const answeringTheirText = lastInbound?.channel === "sms" && Date.now() - new Date(lastInbound.at).getTime() < REPLY_WINDOW_MS && input.trigger !== "followup" && input.trigger !== "form_abandoned";
    if (channel === "sms" && !c.sms_consent && !answeringTheirText) channel = "email";
    if (!dry && channel === "email" && !(c.email && (await canEmailContact(c.id))))
      return (await log({ action: "ignored", decision: { reason: "no way to reach: no text consent and no email thread" } }), { action: "ignored", reason: "Can't text (no consent) and no email thread yet" });

    const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || "the driver";
    const { data: subs } = await db.from("crm_form_submissions").select("created_at, form:crm_forms(name)").eq("contact_id", c.id).order("created_at", { ascending: false }).limit(3);
    const { getCallHours, inCallHours } = await import("@/lib/crm/callme");
    const kenAvailable = inCallHours(await getCallHours());
    const otherForms = (subs ?? []).map((s) => `${(s.form as unknown as { name: string } | null)?.name ?? "form"} (${s.created_at.slice(0, 10)})`);
    const base = { name, city: c.city, state: c.state, localTime: localTime(c.timezone), stage: c.stage, channel, smsConsent: c.sms_consent, hasPhone: !!(c.cell_phone || c.phone), formUrl: link.url, form: link.form, memory: { facts: (mem?.facts as Record<string, unknown>) ?? {}, summary: mem?.summary, next_step: mem?.next_step }, turns, trigger: promptTrigger, followupAttempt: input.followupAttempt, followupKind: input.followupKind, chaseTotal: CHASE.length, alsoText, formSubmitted: input.formSubmitted, otherForms, kenAvailable };

    // Decide: JSON first (2 tries with the checker's feedback), then a plain-text fallback so a driver is never left hanging.
    // Numbers a person gave the assistant to use count as approved.
    const teamAnswers = Object.entries((mem?.facts as Record<string, unknown>) ?? {}).filter(([k]) => k.startsWith("answer_from_team")).map(([, v]) => String(v));
    const messages: ChatMsg[] = buildMessages(base);
    let decision: Decision | null = null;
    let problems: string[] = [];
    let raw = "";
    let costUsd = 0, tokensIn = 0, tokensOut = 0, latency = 0, model = "";
    const track = (r: { costUsd: number; tokensIn: number; tokensOut: number; latencyMs: number; model: string }) => {
      costUsd += r.costUsd; tokensIn += r.tokensIn; tokensOut += r.tokensOut; latency += r.latencyMs; model = r.model;
    };
    const partsOf = (d: Decision) => {
      const raw = (d.replies.length ? d.replies : d.reply ? [d.reply] : []).map(clean).filter(Boolean);
      return channel === "email" ? (raw.length ? [raw.join("\n\n")] : []) : raw.slice(0, 3);
    };
    // The questions that cost the most to get wrong are answered by code, not the AI. Asking again goes to a person.
    const fixed = driverWroteLast && lastInboundTurn && input.trigger !== "followup" && input.trigger !== "form_submitted" ? fixedAnswer(lastInboundTurn.body) : null;
    if (fixed) {
      const alreadySaid = turns.some((t) => t.direction === "outbound" && t.body.includes(fixed.replies[0]));
      const replies = channel === "email" ? [`${fixed.replies.join("\n\n")}\n\nGlobal Runners team`] : fixed.replies;
      decision = { intent: "question", replies: alreadySaid ? [] : replies, facts: {}, stage: null, followup_hours: null, sms_replies: [], handoff: alreadySaid ? FIXED_REPEAT_REASON[fixed.intent] : null } as Decision;
    }
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
      const bad = parts.flatMap((t) => checkReply(t, { channel, formUrl: link.url, extraAllowed: teamAnswers }).problems);
      if (!bad.length) { decision = { ...parsed, replies: parts }; problems = []; break; }
      problems = bad;
      messages.push({ role: "assistant", content: r.content.slice(0, 2000) }, { role: "user", content: `[INSTRUCTION] Your texts broke these rules: ${bad.join("; ")}. Rewrite them so every rule is followed. Return the full JSON again.` });
    }
    if (!decision) {
      // Plain-text fallback: just the reply, no JSON.
      const r = await chatText([...buildMessages(base).slice(0, -1), { role: "user", content: `[INSTRUCTION] Reply to their latest message on ${channel}. Write ONLY the message text${channel === "sms" ? " (1-2 short sentences, under 200 characters)" : ""}, nothing else. No em dashes.` }], { temperature: 0.6, maxTokens: 400 });
      track(r);
      const text = clean(r.content.replace(/^["']|["']$/g, ""));
      const check = checkReply(text, { channel, formUrl: link.url, extraAllowed: teamAnswers });
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
      await moveStage(c as Contact, "unsubscribed", "agent", {}, { reason: "Driver asked to stop", model });
      await log({ action: "unsubscribed", decision, ...meta });
      return { action: "unsubscribed", decision };
    }
    if (decision.intent === "call_request") {
      const { requestCall } = await import("@/lib/crm/callme");
      await requestCall({ contactId: c.id, source: "assistant", notifyDriver: false }); // the assistant's own reply tells the driver
    }
    if (decision.intent === "wrong_person") {
      await suppress(c as Contact, channel, "wrong_person");
      await moveStage(c as Contact, "not_fit", "opt-out", {}, { reason: "Driver said wrong person", model });
    }
    // The AI proposes, the rules decide: its evidence is checked against what the driver really wrote.
    if (decision.stage) {
      const lastOutAt = [...turns].reverse().find((t) => t.direction === "outbound")?.at ?? "";
      const driverText = turns.filter((t) => t.direction === "inbound" && t.at > lastOutAt).map((t) => t.body).join("\n");
      await moveStage(c as Contact, decision.stage, "agent", {}, { quote: decision.stage_quote, driverText, model, reason: decision.intent });
    }
    // Rejecting a driver is never the AI's call, even if it skipped the hand-off.
    if (decision.intent === "not_fit" && !decision.handoff) decision.handoff = `Might not fit: ${decision.summary ?? "see the conversation"}`;

    if (decision.handoff) {
      await handoff(c, decision.handoff);
      await log({ action: "handed_off", decision, ...meta });
      return { action: "handed_off", decision, reason: decision.handoff };
    }

    let action = "no_reply";
    // The first message on each channel says it's AI. Code does this, so it can't be forgotten or talked out of.
    const firstOn = async (ch: "email" | "sms") => !(await db.from("messages").select("*", { count: "exact", head: true }).eq("contact_id", c.id).eq("channel", ch).eq("author", "agent")).count;
    const parts = withDisclosure(decision.replies, channel, await firstOn(channel), fixed?.intent === "identity");
    if (parts.length) {
      const manual = input.trigger === "manual";
      // Human timing: quick in a live back-and-forth, slower after a long silence; extra texts follow like someone typing.
      const lastOut = [...turns].reverse().find((t) => t.direction === "outbound");
      const live = !!lastOut && Date.now() - new Date(lastOut.at).getTime() < 20 * 60_000;
      const replying = input.trigger === "text_received" || input.trigger === "email_received" || input.trigger === "form_submitted";
      // Human cadence (GoHighLevel uses ~60-90s for SMS): live chat 30-75s, reply after a silence 60-150s, plus "typing" time.
      const base = manual ? 5 : replying ? (live ? 30 + Math.random() * 45 : 60 + Math.random() * 90) + parts[0].length * 0.25 : settings.delay_min_s + Math.random() * Math.max(0, settings.delay_max_s - settings.delay_min_s);
      let at = Date.now() + 1000 * base;
      if (input.followupKind !== "chase_extra")
        await db.from("outbox").update({ status: "cancelled", error: "replaced by a newer reply" }).eq("contact_id", c.id).eq("author", "agent").in("status", ["draft", "pending"]);
      const isReply = input.trigger === "text_received" || input.trigger === "email_received" || input.trigger === "form_submitted" || manual || (input.trigger === "interest_label" && driverWroteLast);
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) at += 1000 * (8 + Math.random() * 12 + parts[i].length * 0.15);
        await db.from("outbox").insert({
          contact_id: c.id, channel, author: "agent", subject: i === 0 ? decision.subject ?? null : null, body: parts[i],
          status: settings.draft_mode ? "draft" : "pending", send_after: new Date(at).toISOString(), is_reply: isReply,
        });
      }
      // The extra text that goes with an email reply.
      const checkedTexts = alsoText ? decision.sms_replies.map(clean).filter((t) => t && checkReply(t, { channel: "sms", formUrl: link.url, extraAllowed: teamAnswers }).ok).slice(0, 2) : [];
      const texts = withDisclosure(checkedTexts, "sms", await firstOn("sms"));
      let tAt = Date.now() + 1000 * (90 + Math.random() * 60);
      for (const t of texts) {
        await db.from("outbox").insert({ contact_id: c.id, channel: "sms", author: "agent", body: t, status: settings.draft_mode ? "draft" : "pending", send_after: new Date(tAt).toISOString(), is_reply: false });
        tAt += 1000 * (10 + Math.random() * 15);
      }
      if ([...parts, ...texts].some((t) => t.includes(link.url)) && !link.form.sent) {
        // Sending the link isn't progress by the driver, so the card stays put until they open the form.
        await db.from("form_links").update({ sent_at: new Date().toISOString() }).eq("token", link.token);
      }
      action = settings.draft_mode ? "draft" : "replied";
    }

    // Next touch. The extra email of a "text + email" chase step leaves the schedule alone.
    if (input.followupKind !== "chase_extra") {
      await db.from("followups").update({ status: "cancelled" }).eq("contact_id", c.id).eq("status", "pending");
      const done = ["not_interested", "not_fit", "stop", "wrong_person", "owner_operator"].includes(decision.intent) || decision.stage === "not_interested";
      const linkOut = link.form.sent || [...parts].some((t) => t.includes(link.url)) || decision.sms_replies.some((t) => t.includes(link.url));
      if (!done && !link.form.completed) await scheduleNext(c, { linkOut, kind: input.trigger === "followup" ? input.followupKind ?? "nudge" : null, attempt: input.followupAttempt ?? 0, maxNudges: settings.max_followups });
    }

    await log({ action, decision, reply: parts.join("\n\n") || null, checks: { problems }, ...meta });
    return { action, reply: parts.join("\n\n"), channel, decision, costUsd };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    await log({ action: "failed", decision: { error: reason.slice(0, 500) } }).catch(() => {});
    return { action: "failed", reason, retryable: failureKind(e) === "retry" };
  }
}

/** Email can only go out as a reply in an existing Instantly thread (the first email always comes from a campaign). */
/** Can we email this driver at all? An Instantly thread, or direct email through Resend. */
async function canEmailContact(contactId: string) {
  const { resendConfigured } = await import("@/lib/integrations/resend");
  return resendConfigured() || hasEmailThread(contactId);
}

async function hasEmailThread(contactId: string) {
  const { data } = await adminDb().from("messages").select("meta").eq("contact_id", contactId).eq("channel", "email").not("external_id", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return !!(data?.meta as { eaccount?: string } | null)?.eaccount;
}

/** Plans the next follow-up. Replies restart the chase from step 1 (2h later), the way a recruiter restarts after a conversation. */
export async function scheduleNext(
  c: { id: string; sms_consent: boolean; email: string | null; timezone: string | null; stage: string },
  p: { linkOut: boolean; kind: FollowupKind | null; attempt: number; maxNudges: number },
) {
  const db = adminDb();
  const add = (attempt: number, kind: FollowupKind, channel: "email" | "sms", due: Date, label: string) =>
    db.from("followups").insert({ contact_id: c.id, due_at: due.toISOString(), attempt, kind, channel, reason: label });
  const canText = c.sms_consent;
  const canEmail = !!c.email && (await canEmailContact(c.id));

  if (p.kind === "nurture" || (p.kind === "chase" && p.attempt >= CHASE.length)) {
    const n = p.kind === "nurture" ? p.attempt + 1 : 1;
    if (n > NURTURE_MAX || !canEmail) return;
    if (n === 1) await moveStage(c as unknown as Contact, "nurture", "follow-ups", {}, { force: true, reason: "Follow-ups finished without a form" });
    await add(n, "nurture", "email", inGoodWindow(new Date(Date.now() + NURTURE_GAP_H * 3600_000), c.timezone), `Nurture email #${n}`);
    return;
  }

  if (p.linkOut) {
    // chase: next step (or step 1 after a reply), skipping text-only steps when we can't text
    let i = p.kind === "chase" ? p.attempt : 0; // CHASE index of the next step
    let gap = 0;
    while (i < CHASE.length) {
      gap += CHASE[i].gapH;
      if (canEmail || (CHASE[i].ch === "any" && canText)) break;
      i++;
    }
    if (i >= CHASE.length) return;
    const channel: "email" | "sms" = CHASE[i].ch === "any" && canText ? "sms" : "email";
    const n = i + 1;
    await add(n, "chase", channel, inGoodWindow(new Date(Date.now() + gap * 3600_000), c.timezone), `Form follow-up #${n} (${channel === "sms" ? "text" : "email"})`);
    return;
  }

  // before the link: gentle ladder
  const n = p.kind === "nudge" ? p.attempt + 1 : 1;
  if (n > Math.min(p.maxNudges, FOLLOWUP_LADDER_H.length)) return;
  const ch: "email" | "sms" = canText && n <= MAX_TEXT_FOLLOWUPS ? "sms" : canEmail ? "email" : "sms";
  if (ch === "sms" && !canText) return;
  await add(n, "nudge", ch, inGoodWindow(new Date(Date.now() + FOLLOWUP_LADDER_H[n - 1] * 3600_000), c.timezone), `Follow-up #${n} (${ch === "sms" ? "text" : "email"})`);
}

async function handoff(c: { id: string; first_name: string | null; last_name: string | null }, reason: string) {
  const db = adminDb();
  await db.from("contacts").update({ agent_mode: "manual" }).eq("id", c.id);
  await db.from("tasks").insert({ contact_id: c.id, title: `Reply to driver: ${reason}`.slice(0, 300), created_by: "agent", due_at: new Date(Date.now() + 3600_000).toISOString() });
  await activity(c.id, "handed_to_person", { reason }, "agent");
  await notifyTeam(`Driver needs a person: ${[c.first_name, c.last_name].filter(Boolean).join(" ") || "unknown"}`, `${reason}\n\nOpen: ${siteUrl()}/crm/contacts/${c.id}`);
  await sendTelegram(`🙋 <b>Driver needs a person</b>\n<b>${esc([c.first_name, c.last_name].filter(Boolean).join(" ") || "Unknown")}</b>\n${esc(reason)}\n\n<a href="${siteUrl()}/crm/contacts/${c.id}">Open in GRL Command</a>`);
}

/** Worker: queued runs (new inbound messages) + due follow-ups. */
export async function processAgentQueue(limit = 10) {
  const db = adminDb();
  const out: { contactId: string; action: string }[] = [];
  const { data: queued } = await db.from("agent_runs").select("id, contact_id, trigger, input_message_id, decision").eq("action", "queued").order("created_at").limit(limit);
  // Collapse several queued runs for one driver into one: the newest wins (it sees everything), form info is carried along.
  const latest = new Map<string, NonNullable<typeof queued>[number]>();
  const formInfo = new Map<string, { form: string; sendDriverForm?: boolean }>();
  for (const q of queued ?? []) {
    if (q.trigger === "form_submitted") formInfo.set(q.contact_id, q.decision as { form: string; sendDriverForm?: boolean });
    latest.set(q.contact_id, q);
  }
  for (const q of queued ?? []) {
    if (latest.get(q.contact_id)?.id !== q.id) await db.from("agent_runs").update({ action: "merged" }).eq("id", q.id);
  }
  const seen = new Set<string>();
  for (const q of latest.values()) {
    // Trailing-edge debounce: wait until the driver stops sending for 40s, then answer all their texts at once.
    const { data: lastIn } = await db.from("messages").select("created_at").eq("contact_id", q.contact_id).eq("direction", "inbound").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (lastIn && Date.now() - new Date(lastIn.created_at).getTime() < 40_000) continue;
    if (seen.has(q.contact_id)) {
      await db.from("agent_runs").update({ action: "merged" }).eq("id", q.id);
      continue;
    }
    seen.add(q.contact_id);
    // Only one worker may take a run, even if two ticks overlap.
    const { data: claimed } = await db.from("agent_runs").update({ action: "running" }).eq("id", q.id).eq("action", "queued").select("id").maybeSingle();
    if (!claimed) continue;
    const fi = formInfo.get(q.contact_id);
    const trig = (fi && q.trigger !== "text_received" && q.trigger !== "email_received" ? "form_submitted" : q.trigger) as RunInput["trigger"];
    const r = await runAgent({ contactId: q.contact_id, trigger: trig, inputMessageId: q.input_message_id, runId: q.id, formSubmitted: fi });
    out.push({ contactId: q.contact_id, action: r.action });
    if (r.action === "failed") {
      const { count: fails } = await db.from("agent_runs").select("*", { count: "exact", head: true }).eq("contact_id", q.contact_id).eq("action", "failed").gte("created_at", new Date(Date.now() - 3600_000).toISOString());
      if (r.retryable && (fails ?? 0) < MAX_TRIES) await db.from("agent_runs").insert({ contact_id: q.contact_id, trigger: q.trigger, input_message_id: q.input_message_id, action: "queued", decision: q.decision });
      else await escalateToPerson(q.contact_id, `The assistant couldn't reply: ${r.reason ?? "unknown error"}`);
    }
  }
  const { data: due } = await db.from("followups").select("id, contact_id, attempt, kind, channel, due_at").eq("status", "pending").lte("due_at", new Date().toISOString()).order("due_at").limit(limit);
  for (const f of due ?? []) {
    // Claim by pushing the due time forward: if this worker dies, the follow-up comes back on its own instead of vanishing.
    const { data: claimed } = await db.from("followups").update({ due_at: new Date(Date.now() + FOLLOWUP_LEASE_MS).toISOString() }).eq("id", f.id).eq("status", "pending").eq("due_at", f.due_at).select("id").maybeSingle();
    if (!claimed) continue;
    const r = await runAgent({ contactId: f.contact_id, trigger: "followup", followupAttempt: f.attempt, followupKind: (f.kind as FollowupKind) ?? "nudge", followupChannel: (f.channel as "email" | "sms" | null) ?? null });
    out.push({ contactId: f.contact_id, action: `followup:${r.action}` });
    if (r.action === "failed") {
      const { count: fails } = await db.from("agent_runs").select("*", { count: "exact", head: true }).eq("contact_id", f.contact_id).eq("trigger", "followup").eq("action", "failed").gte("created_at", new Date(Date.now() - 6 * 3600_000).toISOString());
      if (r.retryable && (fails ?? 0) < MAX_TRIES) continue; // the lease brings it back in 10 minutes
      await escalateToPerson(f.contact_id, `A follow-up couldn't be written: ${r.reason ?? "unknown error"}`);
    }
    await db.from("followups").update({ status: "done" }).eq("id", f.id).eq("status", "pending");
  }
  return out;
}
