import { describe, expect, it } from "vitest";
import { gate, inQuietHours, type GateInput } from "@/lib/crm/sendGate";
import { failureKind, needsRescue } from "@/lib/agent/recovery";
import { isOptOut, isWrongNumber } from "@/lib/crm/ingest";
import { actorType, decideMove, quoteFound } from "@/lib/crm/pipeline";

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
