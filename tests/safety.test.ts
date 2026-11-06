import { describe, expect, it } from "vitest";
import { gate, inQuietHours, type GateInput } from "@/lib/crm/sendGate";
import { failureKind, needsRescue } from "@/lib/agent/recovery";
import { isOptOut, isWrongNumber, redact } from "@/lib/crm/ingest";
import { HUMAN_WORDS } from "@/lib/agent/engine";
import { actorType, decideMove, isClosed, outcomeOf, quoteFound, webhookSilent } from "@/lib/crm/pipeline";
import { EVAL_CASES, judge } from "@/lib/agent/evalCases";
import { checkReply } from "@/lib/agent/checks";
import { DISCLOSURE_EMAIL, DISCLOSURE_TEXT, fixedAnswer, withDisclosure } from "@/lib/agent/fixed";
import { consentFromEmail, consentFromText } from "@/lib/crm/consent";
import { canAutoSend, duplicateReason, groupFromKey, groupKey, reviewProgress, riskGroup } from "@/lib/agent/graduation";

// Wednesday Nov 4 2026, noon in Las Vegas
const NOON = new Date("2026-11-04T20:00:00Z");
const contact = { doNotContact: false, emailConsent: true, smsConsent: true, email: "d@x.com", phone: "+17025550100", timezone: "America/Los_Angeles", agentMode: "auto", pausedUntil: null };
const base: GateInput = { channel: "sms", author: "agent", approvedByPerson: false, isReply: false, createdAt: "2026-11-04T19:00:00Z", contact, suppressed: false, lastInboundAt: null, proactiveTexts24h: 0, now: NOON };
const run = (patch: Partial<GateInput>, c: Partial<GateInput["contact"]> = {}) => gate({ ...base, ...patch, contact: { ...contact, ...c } }).action;

describe("send gate", () => {
  it("sends an ordinary follow-up in hours", () => expect(run({})).toBe("send"));
  it("stops automated messages to a do-not-contact driver", () => expect(run({}, { doNotContact: true })).toBe("cancel"));
  it("reports a person's message to a do-not-contact driver as a failure they can see", () => expect(run({ author: "human" }, { doNotContact: true })).toBe("fail"));
  it("stops the AI when a person owns the driver", () => expect(run({}, { agentMode: "manual" })).toBe("cancel"));
  it("stops the AI during a human pause", () => expect(run({}, { pausedUntil: "2026-11-04T21:00:00Z" })).toBe("cancel"));
  it("ignores a pause that has ended", () => expect(run({}, { pausedUntil: "2026-11-04T19:30:00Z" })).toBe("send"));
  it("lets a person's approved draft through while they own the driver", () => expect(run({ approvedByPerson: true }, { agentMode: "manual" })).toBe("send"));
  it("drops an AI message when the driver wrote after it was prepared", () => expect(run({ lastInboundAt: "2026-11-04T19:30:00Z" })).toBe("cancel"));
  it("keeps an AI message written after the driver's latest message", () => expect(run({ lastInboundAt: "2026-11-04T18:30:00Z" })).toBe("send"));
  it("never texts without consent", () => expect(run({ approvedByPerson: true }, { smsConsent: false })).toBe("fail"));
  it("never texts a suppressed number", () => expect(run({ author: "human", suppressed: true })).toBe("fail"));
  it("fails cleanly with no phone number", () => expect(run({}, { phone: null })).toBe("fail"));
  it("never emails an unsubscribed driver", () => expect(run({ channel: "email" }, { emailConsent: false })).toBe("fail"));
  it("holds a proactive text at night", () => expect(run({ now: new Date("2026-11-05T05:00:00Z") })).toBe("wait"));
  it("answers a driver's fresh message at night", () => expect(run({ isReply: true, createdAt: "2026-11-05T04:59:00Z", lastInboundAt: "2026-11-05T04:50:00Z", now: new Date("2026-11-05T05:00:00Z") })).toBe("send"));
  it("treats a stale reply as proactive at night", () => expect(run({ isReply: true, createdAt: "2026-11-04T23:00:00Z", lastInboundAt: "2026-11-04T22:30:00Z", now: new Date("2026-11-05T05:00:00Z") })).toBe("wait"));
  it("holds a fourth proactive text in 24 hours", () => expect(run({ proactiveTexts24h: 3 })).toBe("wait"));
  it("does not limit a fresh reply", () => expect(run({ isReply: true, createdAt: "2026-11-04T19:59:00Z", lastInboundAt: "2026-11-04T19:50:00Z", proactiveTexts24h: 3 })).toBe("send"));
  it("email has no quiet hours", () => expect(run({ channel: "email", now: new Date("2026-11-05T05:00:00Z") })).toBe("send"));
});

describe("quiet hours (texts we start: 9am-8pm driver time, Sunday from noon)", () => {
  const at = (iso: string) => new Date(iso);
  it("8:59am in Los Angeles is quiet", () => expect(inQuietHours("America/Los_Angeles", at("2026-11-04T16:59:00Z"))).toBe(true));
  it("9:00am in Los Angeles is open", () => expect(inQuietHours("America/Los_Angeles", at("2026-11-04T17:00:00Z"))).toBe(false));
  it("7:59pm in New York is open", () => expect(inQuietHours("America/New_York", at("2026-11-05T00:59:00Z"))).toBe(false));
  it("8:00pm in New York is quiet", () => expect(inQuietHours("America/New_York", at("2026-11-05T01:00:00Z"))).toBe(true));
  it("11am Sunday is quiet", () => expect(inQuietHours("America/Los_Angeles", at("2026-11-08T19:00:00Z"))).toBe(true));
  it("noon Sunday is open", () => expect(inQuietHours("America/Los_Angeles", at("2026-11-08T20:00:00Z"))).toBe(false));
  it("unknown zone: quiet at 11am Eastern (8am Pacific)", () => expect(inQuietHours(null, at("2026-11-04T16:00:00Z"))).toBe(true));
  it("unknown zone: open at noon Eastern (9am Pacific)", () => expect(inQuietHours(null, at("2026-11-04T17:00:00Z"))).toBe(false));
  it("unknown zone: quiet at 8pm Eastern", () => expect(inQuietHours(null, at("2026-11-05T01:00:00Z"))).toBe(true));
});

describe("opt-outs stricter than the phone provider's", () => {
  it.each(["PLEASE CANCEL", "stop please", "Stop now", "please stop", "revoke", "OPT OUT", "no more texts", "lose my number", "delete my number", "quit texting me", "no me escribas", "deja de escribirme"])("treats %j as opt-out", (t) => expect(isOptOut(t)).toBe(true));
  it.each(["don't stop now, tell me more", "please cancel my other interview", "when can I stop by the yard", "no more than 3 violations"])("does not treat %j as opt-out", (t) => expect(isOptOut(t)).toBe(false));
  it.each(["wrong number", "you have the wrong person", "Wrong number!"])("treats %j as a wrong number", (t) => expect(isWrongNumber(t)).toBe(true));
  it.each(["what's wrong with the truck", "is that number right"])("does not treat %j as a wrong number", (t) => expect(isWrongNumber(t)).toBe(false));
});

describe("what happens when the AI call fails", () => {
  it.each([429, 500, 503])("retries on %i", (status) => expect(failureKind({ status })).toBe("retry"));
  it.each([400, 401, 402, 422])("gets a person at once on %i", (status) => expect(failureKind({ status })).toBe("person"));
  it("gets a person when the key is missing", () => expect(failureKind(new Error("DEEPSEEK_API_KEY is not set"))).toBe("person"));
  it("retries a timeout", () => expect(failureKind(new Error("The operation was aborted due to timeout"))).toBe("retry"));
});

describe("no driver left without an answer", () => {
  const inbound = "2026-11-04T19:00:00Z";
  const b = { lastInboundAt: inbound, lastOutboundAt: null, waiting: false, taskSinceInbound: false, lastRunAction: null, autoReply: false, now: NOON };
  it("rescues a driver nobody answered", () => expect(needsRescue(b)).toBe(true));
  it("leaves a recent message alone", () => expect(needsRescue({ ...b, now: new Date("2026-11-04T19:10:00Z") })).toBe(false));
  it("skips when we answered", () => expect(needsRescue({ ...b, lastOutboundAt: "2026-11-04T19:05:00Z" })).toBe(false));
  it("skips when a reply or draft is waiting", () => expect(needsRescue({ ...b, waiting: true })).toBe(false));
  it("skips when a person already has a task", () => expect(needsRescue({ ...b, taskSinceInbound: true })).toBe(false));
  it("skips a recorded decision to stay silent", () => expect(needsRescue({ ...b, lastRunAction: "no_reply" })).toBe(false));
  it("skips an out-of-office auto-reply", () => expect(needsRescue({ ...b, autoReply: true })).toBe(false));
  it("rescues when the assistant ignored the message", () => expect(needsRescue({ ...b, lastRunAction: "ignored" })).toBe(true));
  it("rescues when the last run failed", () => expect(needsRescue({ ...b, lastRunAction: "failed" })).toBe(true));
});

describe("pipeline: the AI proposes, rules decide", () => {
  const ai = { actor: "ai" as const, locked: false };
  const said = "yeah sounds good, how do I apply?";
  it("moves to Interested with the driver's exact words", () => expect(decideMove({ ...ai, current: "replied", to: "interested", quote: "Sounds good", driverText: said })).toEqual({ apply: true, to: "interested" }));
  it("rejects a made-up quote", () => expect(decideMove({ ...ai, current: "replied", to: "interested", quote: "I want the job", driverText: said }).apply).toBe(false));
  it("rejects a move with no quote", () => expect(decideMove({ ...ai, current: "replied", to: "interested", driverText: said }).apply).toBe(false));
  it.each(["not_fit", "applied", "qualified", "sent_to_ken", "hired", "form_sent"] as const)("the AI can't set %s", (to) => expect(decideMove({ ...ai, current: "replied", to, quote: "sounds good", driverText: said }).apply).toBe(false));
  it("the AI can't touch a card a person locked", () => expect(decideMove({ ...ai, locked: true, current: "replied", to: "interested", quote: "sounds good", driverText: said }).apply).toBe(false));
  it("the AI can stop outreach without a quote", () => expect(decideMove({ ...ai, current: "interested", to: "not_interested" }).apply).toBe(true));
  it("the AI can't move a card backward", () => expect(decideMove({ ...ai, current: "applied", to: "interested", quote: "sounds good", driverText: said }).apply).toBe(false));
  it("a person can move a card anywhere", () => expect(decideMove({ actor: "human", locked: false, current: "hired", to: "replied" })).toEqual({ apply: true, to: "replied" }));
  it("a finished form moves a locked card", () => expect(decideMove({ actor: "system", locked: true, current: "interested", to: "applied" })).toEqual({ apply: true, to: "applied" }));
  it("an opt-out moves a locked card", () => expect(decideMove({ actor: "system", locked: true, current: "applied", to: "unsubscribed" })).toEqual({ apply: true, to: "unsubscribed" }));
  it("a routine event doesn't move a locked card", () => expect(decideMove({ actor: "system", locked: true, current: "contacted", to: "replied" })).toEqual({ apply: false, quiet: true }));
  it("forward-only still applies to system moves", () => expect(decideMove({ actor: "system", locked: false, current: "applied", to: "replied" })).toEqual({ apply: false, quiet: true }));
  it("running out of follow-ups can move a card back to Nurture", () => expect(decideMove({ actor: "system", locked: false, force: true, current: "interested", to: "nurture" })).toEqual({ apply: true, to: "nurture" }));
  it("classifies actors", () => { expect(actorType("user:abc")).toBe("human"); expect(actorType("agent")).toBe("ai"); expect(actorType("instantly")).toBe("system"); });
  it("quote matching ignores case, quotes and spacing", () => expect(quoteFound('"HOW  do I apply"', said)).toBe(true));
});

describe("answers code gives without the AI", () => {
  it.each(["how much u pay", "What do you pay?", "whats the pay", "how much can I make", "CPM?", "how many cents per mile"])("%j gets the pay answer", (t) => expect(fixedAnswer(t)?.intent).toBe("pay"));
  it.each(["are you a bot", "is this a real person?", "am I talking to a robot", "Are you AI"])("%j gets the honest answer", (t) => expect(fixedAnswer(t)?.intent).toBe("identity"));
  it.each(["sounds good", "where is the yard", "I have 5 years OTR and I want to know about home time and also how much you pay and whether my dog can ride along with me"])("%j goes to the AI", (t) => expect(fixedAnswer(t)).toBeNull());
  it("the pay answer never gives a rate", () => expect(fixedAnswer("how much u pay")!.replies.join(" ")).not.toMatch(/cents?|cpm|\d\.\d/i));
  it.each([["sms"], ["email"]] as const)("the fixed answers pass the reply checks on %s", (channel) => {
    for (const q of ["how much u pay", "are you a bot"]) for (const t of fixedAnswer(q)!.replies) expect(checkReply(t, { channel, formUrl: "https://x.test/f" }).problems).toEqual([]);
  });
});

describe("saying it's AI", () => {
  it("a first text gets its own message with the opt-out", () => expect(withDisclosure(["hey"], "sms", true)).toEqual([DISCLOSURE_TEXT, "hey"]));
  it("a first email gets a line", () => expect(withDisclosure(["hello"], "email", true)[0]).toContain(DISCLOSURE_EMAIL));
  it("later messages don't repeat it", () => expect(withDisclosure(["hey"], "sms", false)).toEqual(["hey"]));
  it("skips it when the answer already says so", () => expect(withDisclosure(["I'm an AI"], "sms", true, true)).toEqual(["I'm an AI"]));
  it.each([DISCLOSURE_TEXT, DISCLOSURE_EMAIL])("%j passes the reply checks", (t) => expect(checkReply(t, { channel: "sms", formUrl: "https://x.test/f" }).problems).toEqual([]));
});

describe("permission to text", () => {
  it("a number alone isn't permission", () => expect(consentFromEmail("my cell is 702 555 0199", true)).toEqual({ cell: "+17025550199", consent: false }));
  it("a number with yes is", () => expect(consentFromEmail("yes, 702-555-0199", false).consent).toBe(true));
  it("asking to be texted is, with a phone on file", () => expect(consentFromEmail("just text me", true).consent).toBe(true));
  it("asking to be texted needs a number", () => expect(consentFromEmail("just text me", false).consent).toBe(false));
  it("a bare yes in email isn't", () => expect(consentFromEmail("yes I'm interested", true).consent).toBe(false));
  it("YES counts when we asked about texting", () => expect(consentFromText("YES", "ok if we keep texting you about this? reply YES")).toBe(true));
  it("YES doesn't count when we asked something else", () => expect(consentFromText("yes", "do you have a CDL-A?")).toBe(false));
  it("yes with more words doesn't count as permission", () => expect(consentFromText("yes but not on weekends", "ok to text you?")).toBe(false));
  it("telling us to text does", () => expect(consentFromText("you can text me", null)).toBe(true));
});

describe("replying to a driver who texted us", () => {
  const fresh = { isReply: true, createdAt: "2026-11-04T19:59:00Z", lastInboundAt: "2026-11-04T19:50:00Z", lastInboundChannel: "sms" as const };
  it("may answer their text without standing consent", () => expect(run(fresh, { smsConsent: false })).toBe("send"));
  it("may not follow up later without consent", () => expect(run({ ...fresh, now: new Date("2026-11-05T00:00:00Z"), createdAt: "2026-11-04T23:59:00Z" }, { smsConsent: false })).toBe("fail"));
  it("an email from them doesn't allow a text", () => expect(run({ ...fresh, lastInboundChannel: "email" }, { smsConsent: false })).toBe("fail"));
  it("an opt-out still wins", () => expect(run({ ...fresh, suppressed: true }, { smsConsent: false })).toBe("fail"));
});

describe("promises the AI can't make", () => {
  it.each(["you're hired", "you qualify for this", "you are approved", "I promise you'll get miles"])("blocks %j", (t) => expect(checkReply(t, { channel: "sms", formUrl: "https://x.test/f" }).ok).toBe(false));
});

describe("earning auto-send", () => {
  const clean = (group: string, n: number) => Array.from({ length: n }, () => ({ group }));
  it("sorts messages by kind", () => {
    expect(riskGroup({ trigger: "text_received", intent: "question", fixed: true })).toBe("fixed");
    expect(riskGroup({ trigger: "followup", intent: "other", fixed: false })).toBe("followups");
    expect(riskGroup({ trigger: "text_received", intent: "question", fixed: false })).toBe("questions");
    expect(riskGroup({ trigger: "text_received", intent: "interested", fixed: false })).toBe("general");
  });
  it("reads the group back from the key", () => { expect(groupFromKey(groupKey("followups", "abc"))).toBe("followups"); expect(groupFromKey("wf:1:send_text:3")).toBeNull(); expect(groupFromKey(null)).toBeNull(); });
  it("never auto-sends on unapproved facts, even with draft mode off", () => expect(canAutoSend({ group: "questions", draftMode: false, factsApproved: false, autoGroups: ["questions"] })).toBe(false));
  it("drafts a group that hasn't been switched on", () => expect(canAutoSend({ group: "questions", draftMode: true, factsApproved: true, autoGroups: ["fixed"] })).toBe(false));
  it("sends a group that has", () => expect(canAutoSend({ group: "fixed", draftMode: true, factsApproved: true, autoGroups: ["fixed"] })).toBe(true));
  it("draft mode off sends everything once facts are approved", () => expect(canAutoSend({ group: "general", draftMode: false, factsApproved: true, autoGroups: [] })).toBe(true));
  it("99 clean reviews isn't enough", () => expect(reviewProgress("questions", clean("questions", 99)).ready).toBe(false));
  it("100 clean reviews is", () => expect(reviewProgress("questions", clean("questions", 100)).ready).toBe(true));
  it("too many changes holds it back", () => expect(reviewProgress("questions", [...clean("questions", 100), ...Array.from({ length: 20 }, () => ({ group: "questions", edited: true }))]).ready).toBe(false));
  it("discards count against it", () => expect(reviewProgress("general", [{ group: "general", discarded: true }]).changed).toBe(1));
  it("other groups' reviews don't count", () => expect(reviewProgress("general", clean("questions", 200)).reviewed).toBe(0));
  it("fixed answers need no track record", () => expect(reviewProgress("fixed", []).ready).toBe(true));
});

describe("likely duplicates", () => {
  const p = { id: "a", first_name: "Luis", last_name: "Ortega", phone: "+17025550100", cell_phone: null, company_name: null, state: "NV" };
  it("matches a phone across fields", () => expect(duplicateReason(p, { ...p, id: "b", phone: null, cell_phone: "+17025550100", first_name: "X" })).toBe("Same phone number"));
  it("matches name and state", () => expect(duplicateReason(p, { ...p, id: "b", phone: "+17025550111", first_name: "luis" })).toBe("Same name and state"));
  it("name alone isn't enough", () => expect(duplicateReason(p, { ...p, id: "b", phone: null, state: "AZ" })).toBeNull());
  it("a record isn't its own duplicate", () => expect(duplicateReason(p, p)).toBeNull());
});

describe("the assistant's test set", () => {
  const ok = { reply: "It's per mile, paid every Thursday.", handoff: false, stops: false };
  const byName = (n: string) => EVAL_CASES.find((c) => c.name === n)!;
  it("has at least 30 cases with unique names", () => { expect(EVAL_CASES.length).toBeGreaterThanOrEqual(30); expect(new Set(EVAL_CASES.map((c) => c.name)).size).toBe(EVAL_CASES.length); });
  it.each(["normal", "pay", "injection", "handoff", "stop", "off-limits", "honesty"])("covers %s", (g) => expect(EVAL_CASES.some((c) => c.group === g)).toBe(true));
  it("passes a good pay answer", () => expect(judge(byName("pay, fixed answer"), ok)).toEqual([]));
  it("catches a stated rate", () => expect(judge(byName("pay, fixed answer"), { ...ok, reply: "per mile, 80 cents per mile" }).length).toBeGreaterThan(0));
  it("catches a missed hand-off", () => expect(judge(byName("legal threat"), ok).length).toBeGreaterThan(0));
  it("catches a missed stop", () => expect(judge(byName("not interested"), ok).length).toBeGreaterThan(0));
  it("catches a promise", () => expect(judge(byName("fake staff approval"), { ...ok, reply: "you're hired" }).length).toBeGreaterThan(0));
  it("catches claiming to be human", () => expect(judge(byName("is this a scam"), { ...ok, reply: "I'm a real person" }).length).toBeGreaterThan(0));
  it("counts a failure as a failure", () => expect(judge(byName("asks about pets"), { ...ok, failed: true }).length).toBe(1));
  it("the set's own fixed answers pass", () => {
    for (const c of EVAL_CASES) { const f = fixedAnswer(c.driver.at(-1)!); if (f) expect(judge(c, { reply: f.replies.join("\n"), handoff: false, stops: false })).toEqual([]); }
  });
});

describe("closed drivers and real events", () => {
  it("a finished form reopens a not-interested driver", () => expect(decideMove({ actor: "system", locked: false, current: "not_interested", to: "applied" })).toEqual({ apply: true, to: "applied" }));
  it("a finished form reopens a not-a-fit driver for review", () => expect(decideMove({ actor: "system", locked: false, current: "not_fit", to: "applied" })).toEqual({ apply: true, to: "applied" }));
  it("a form doesn't undo an opt-out", () => expect(decideMove({ actor: "system", locked: false, current: "unsubscribed", to: "applied" }).apply).toBe(false));
  it("a form doesn't undo a hire", () => expect(decideMove({ actor: "system", locked: false, current: "hired", to: "applied" }).apply).toBe(false));
  it.each(["not_fit", "not_interested", "unsubscribed", "bounced", "hired"] as const)("%s is closed", (s) => expect(isClosed(s)).toBe(true));
  it.each(["replied", "interested", "nurture", "applied"] as const)("%s isn't", (s) => expect(isClosed(s)).toBe(false));
});

describe("noticing when Instantly goes quiet", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  it("alerts after 3 days of silence with a live campaign", () => expect(webhookSilent({ lastEventAt: "2026-11-07T11:00:00Z", activeCampaigns: 1, lastAlertAt: null, now })).toBe(true));
  it("alerts when a live campaign has never sent an event", () => expect(webhookSilent({ lastEventAt: null, activeCampaigns: 1, lastAlertAt: null, now })).toBe(true));
  it("stays quiet with no live campaign", () => expect(webhookSilent({ lastEventAt: null, activeCampaigns: 0, lastAlertAt: null, now })).toBe(false));
  it("stays quiet when events are flowing", () => expect(webhookSilent({ lastEventAt: "2026-11-09T12:00:00Z", activeCampaigns: 1, lastAlertAt: null, now })).toBe(false));
  it("alerts once a day at most", () => expect(webhookSilent({ lastEventAt: null, activeCampaigns: 1, lastAlertAt: "2026-11-10T01:00:00Z", now })).toBe(false));
});

describe("how each conversation ended", () => {
  const base = { stage: "interested" as const, doNotContact: false, agentMode: "auto", formCompleted: false, lastInboundAt: "2026-11-09T12:00:00Z", lastOutboundAt: "2026-11-09T12:05:00Z", now: new Date("2026-11-10T12:00:00Z") };
  it("in progress", () => expect(outcomeOf(base)).toBe("In progress"));
  it("form completed", () => expect(outcomeOf({ ...base, formCompleted: true })).toBe("Form completed"));
  it("opted out wins", () => expect(outcomeOf({ ...base, formCompleted: true, doNotContact: true })).toBe("Opted out"));
  it("handed off", () => expect(outcomeOf({ ...base, agentMode: "manual" })).toBe("Handed off"));
  it("not qualified", () => expect(outcomeOf({ ...base, stage: "not_fit" })).toBe("Not qualified"));
  it("not interested", () => expect(outcomeOf({ ...base, stage: "not_interested" })).toBe("Not interested"));
  it("a quiet driver never counts as success", () => expect(outcomeOf({ ...base, lastOutboundAt: "2026-10-20T00:00:00Z", lastInboundAt: "2026-10-19T00:00:00Z" })).toBe("Went quiet"));
  it("nurture is quiet", () => expect(outcomeOf({ ...base, stage: "nurture" })).toBe("Went quiet"));
  it("hired", () => expect(outcomeOf({ ...base, stage: "hired", formCompleted: true })).toBe("Hired"));
});

describe("code catches these before the AI", () => {
  it.each(["are you turning me down because I'm over 60?", "that's discrimination", "I have diabetes, does that matter", "I need an accommodation", "I got hurt on my last job", "you guys still owe me for two weeks", "my medical card expired"])("%j goes to a person", (t) => expect(HUMAN_WORDS.test(t)).toBe(true));
  it.each(["I have no accidents", "how do I apply", "what's the pay", "are you human?", "because I want to work"])("%j doesn't", (t) => expect(HUMAN_WORDS.test(t)).toBe(false));
  it("removes a Social Security number", () => expect(redact("my ssn is 123-45-6789 ok")).toBe("my ssn is [SSN removed] ok"));
  it("leaves a phone number alone", () => expect(redact("call 702-555-0199")).toBe("call 702-555-0199"));
});

describe("topics only Ken can confirm", () => {
  it.each(["is the $2000 weekly minimum guaranteed?", "do I need a hazmat endorsement", "what are the trucks governed at", "whats the speed limiter set to"])("%j gets the Ken answer", (t) => expect(fixedAnswer(t)?.intent).toBe("unconfirmed"));
  it.each(["I'm on a green card, is that ok?", "do you sponsor a work visa", "I'm not a citizen but I have 10 years experience driving OTR across the whole country, and I am ready to start next week if you have room"])("%j is never judged", (t) => expect(fixedAnswer(t)?.intent).toBe("status"));
  it("the set answers pass the reply checks", () => { for (const q of ["do I need hazmat", "green card ok?"]) for (const t of fixedAnswer(q)!.replies) expect(checkReply(t, { channel: "sms", formUrl: "https://x.test/f" }).problems).toEqual([]); });
  it.each(["we don't do a weekly minimum", "nah there's no minimum", "you don't need hazmat", "no hazmat needed"])("blocks the denial %j", (t) => expect(checkReply(t, { channel: "sms", formUrl: "https://x.test/f" }).ok).toBe(false));
});
