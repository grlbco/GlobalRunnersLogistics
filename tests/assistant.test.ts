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
    ["not X it's Y", "It's not just a job, it's a career"],
    ["buzzword", "Rest assured, we got you"],
    ["foreign link", "Apply at https://example.com/apply"],
    ["made-up rate", "We pay 70 cents per mile"],
  ])("blocks %s", (_n, text) => expect(checkReply(text, ctx).ok).toBe(false));
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
  it("leaves the time alone when we don't know the zone", () => {
    const t = new Date("2026-11-05T11:00:00Z");
    expect(inGoodWindow(t, null)).toBe(t);
  });
});
