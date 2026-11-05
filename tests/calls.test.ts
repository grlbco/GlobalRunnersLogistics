import { describe, expect, it } from "vitest";
import { isMissed } from "@/lib/crm/calls";
import { inCallHours } from "@/lib/crm/callme";

describe("missed calls (texted back automatically)", () => {
  it.each(["missed", "no-answer", "abandoned", "busy", "canceled"])("incoming %s is missed", (status) => expect(isMissed({ direction: "incoming", status, answeredAt: null, duration: 0 })).toBe(true));
  it("incoming completed without an answer is missed", () => expect(isMissed({ direction: "incoming", status: "completed", answeredAt: null, duration: 0 })).toBe(true));
  it("answered call is not missed", () => expect(isMissed({ direction: "incoming", status: "completed", answeredAt: "2026-11-05T15:00:00Z", duration: 120 })).toBe(false));
  it("our own outgoing call is never 'missed'", () => expect(isMissed({ direction: "outgoing", status: "no-answer", answeredAt: null, duration: 0 })).toBe(false));
});

describe("Ken's call hours (Call me now)", () => {
  const h = { start: "07:00", end: "19:00", tz: "America/Los_Angeles", days: [1, 2, 3, 4, 5, 6] };
  it("Thursday 10am Pacific: available", () => expect(inCallHours(h, new Date("2026-11-05T18:00:00Z"))).toBe(true));
  it("Thursday 6:30am Pacific: not yet", () => expect(inCallHours(h, new Date("2026-11-05T14:30:00Z"))).toBe(false));
  it("Thursday 7pm Pacific: done for the day", () => expect(inCallHours(h, new Date("2026-11-06T03:00:00Z"))).toBe(false));
  it("Sunday: off", () => expect(inCallHours(h, new Date("2026-11-08T18:00:00Z"))).toBe(false));
});
