import { describe, expect, it } from "vitest";
import { checkReply } from "@/lib/agent/checks";
import { inGoodWindow } from "@/lib/agent/engine";

const ctx = { channel: "sms" as const, formUrl: "https://globalrunnerslogistics.com/apply/driver?t=abc" };

describe("assistant safety checks (every message before it sends)", () => {
  it("passes a normal human text", () => expect(checkReply("It's per mile, paid every Thursday. Ken goes over the rate on the call", ctx).ok).toBe(true));
  it.each([
    ["em dash", "Great pay — weekly"],
    ["semicolon", "Paid weekly; plus bonus"],
    ["AI giveaway", "As an AI, I can help"],
    ["claiming to be human", "So yeah, real person here, just not Ken"],
    ["denying being a bot", "I'm not a bot, promise"],
    ["signing as Ken", "Form's here: https://globalrunnerslogistics.com/apply/driver?t=abc\n\nKen / Global Runners"],
    ["offering to call", "Once it's in, I'll give you a call"],
    ["not X it's Y", "It's not just a job, it's a career"],
    ["buzzword", "Rest assured, we got you"],
    ["foreign link", "Apply at https://example.com/apply"],
    ["made-up rate", "We pay 70 cents per mile"],
  ])("blocks %s", (_n, text) => expect(checkReply(text, ctx).ok).toBe(false));
  it("allows an honest AI answer", () => expect(checkReply("I'm an AI assistant, I help Ken with texts. Ken's real, he calls everyone himself", ctx).ok).toBe(true));
  it("allows the driver's own form link", () => expect(checkReply(`Here's the form: ${ctx.formUrl}`, ctx).ok).toBe(true));
  it("blocks texts that are too long", () => expect(checkReply("a ".repeat(200), ctx).ok).toBe(false));
});

describe("follow-up timing (10–11am or 5–6:30pm driver time, never Sunday)", () => {
  const hourIn = (d: Date, tz: string) => Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(d)) % 24;
  const dayIn = (d: Date, tz: string) => new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(d);
  it("moves a 3am follow-up to the 10am window", () => {
    const d = inGoodWindow(new Date("2026-11-05T11:00:00Z"), "America/Chicago"); // 5am Chicago
    expect(hourIn(d, "America/Chicago")).toBe(10);
  });
  it("skips Sunday", () => {
    const d = inGoodWindow(new Date("2026-11-08T15:00:00Z"), "America/Chicago"); // Sunday 9am
    expect(dayIn(d, "America/Chicago")).toBe("Mon");
  });
  it("unknown zone is timed on Central", () => {
    const d = inGoodWindow(new Date("2026-11-05T11:00:00Z"), null);
    expect(hourIn(d, "America/Chicago")).toBe(10);
  });
});

describe("hand-off words", async () => {
  const { HUMAN_WORDS } = await import("@/lib/agent/engine");
  it.each(["can I talk to a real person", "let me speak with your manager", "my lawyer will call", "I'm filing a complaint"])("hands off %j", (t) => expect(HUMAN_WORDS.test(t)).toBe(true));
  it.each(["are you human?", "is this a scam?", "am I talking to a bot", "how much do you pay"])("answers %j itself", (t) => expect(HUMAN_WORDS.test(t)).toBe(false));
});
