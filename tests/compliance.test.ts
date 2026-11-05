import { describe, expect, it } from "vitest";
import { isOptOut, advance } from "@/lib/crm/ingest";
import { inQuietHours } from "@/lib/crm/outbox";
import { ownWords } from "@/lib/crm/sync";

describe("opt-out (TCPA / CAN-SPAM)", () => {
  it.each(["STOP", "stop", " Stop. ", "unsubscribe", "Cancel", "QUIT", "opt out", "opt-out", "STOPALL", "end"])("treats %j as opt-out", (t) => expect(isOptOut(t)).toBe(true));
  it.each(["please stop texting me", "don't text me anymore", "remove me from your list", "take me off this", "leave me alone"])("treats plain language %j as opt-out", (t) => expect(isOptOut(t)).toBe(true));
  it.each(["I can't stop thinking about this job", "what time does your shift end?", "sounds good", "how much do you pay", "I'll cancel my other interview"])("does not treat %j as opt-out", (t) => expect(isOptOut(t)).toBe(false));
});

describe("quiet hours (texts we start: 8am–9pm driver time)", () => {
  const at = (iso: string) => new Date(iso);
  it("7:59am in Los Angeles is quiet", () => expect(inQuietHours("America/Los_Angeles", at("2026-11-05T15:59:00Z"))).toBe(true));
  it("8:00am in Los Angeles is open", () => expect(inQuietHours("America/Los_Angeles", at("2026-11-05T16:00:00Z"))).toBe(false));
  it("8:59pm in New York is open", () => expect(inQuietHours("America/New_York", at("2026-11-06T01:59:00Z"))).toBe(false));
  it("9:00pm in New York is quiet", () => expect(inQuietHours("America/New_York", at("2026-11-06T02:00:00Z"))).toBe(true));
  it("unknown time zone never blocks", () => expect(inQuietHours(null)).toBe(false));
});

describe("pipeline stages only move forward automatically", () => {
  it("replied → applied moves", () => expect(advance("replied", "applied")).toBe("applied"));
  it("applied → replied does not move back", () => expect(advance("applied", "replied")).toBe("applied"));
  it("form_sent → chasing moves", () => expect(advance("form_sent", "chasing")).toBe("chasing"));
  it("chasing → applied moves", () => expect(advance("chasing", "applied")).toBe("applied"));
  it("nurture → replied moves (they came back)", () => expect(advance("nurture", "replied")).toBe("replied"));
  it("opt-out always wins", () => expect(advance("applied", "unsubscribed")).toBe("unsubscribed"));
  it("hired is final", () => expect(advance("hired", "not_interested")).toBe("hired"));
});

describe("email reply parsing (consent from email)", () => {
  it("drops the quoted thread", () => {
    const body = "yes text me at 702 555 0199\n\nOn Tue, Nov 3, 2026 at 9:00 AM Ken <ken@x.com> wrote:\n> are you still driving? call 312 975 3377";
    expect(ownWords(body)).toBe("yes text me at 702 555 0199\n");
  });
  it("drops > quoted lines", () => expect(ownWords("ok\n> old stuff")).toBe("ok"));
});
