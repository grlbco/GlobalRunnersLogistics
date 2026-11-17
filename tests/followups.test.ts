import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/crm/admin", () => ({ adminDb: () => ({}) }));

import { reSubject } from "@/lib/crm/outbox";
import { ownWords } from "@/lib/integrations/telegram";
import { isConcern, answersFromLead } from "@/lib/crm/applications";
import { checkReply } from "@/lib/agent/checks";
import { formUrl } from "@/lib/site";

describe("same email thread", () => {
  it("always answers as Re: <original subject>, never Re: Re:", () => {
    expect(reSubject("cdl-a driver job in henderson")).toBe("Re: cdl-a driver job in henderson");
    expect(reSubject("Re: cdl-a driver job in henderson")).toBe("Re: cdl-a driver job in henderson");
    expect(reSubject("RE: re: Fwd: your cdl, our truck")).toBe("Re: your cdl, our truck");
  });
});

describe("short form link", () => {
  it("is the bare domain + /a/<code>", () => {
    expect(formUrl("x7Kq2p")).toMatch(/^[a-z0-9.-]+\.[a-z]+\/a\/x7Kq2p$/);
    expect(formUrl("x7Kq2p")).not.toMatch(/https?:|www\./);
  });
  it("passes the reply checks with or without https://", () => {
    const url = "globalrunnerslogistics.com/a/x7Kq2p";
    expect(checkReply(`Here's the short form, takes about 2 min: ${url}`, { channel: "sms", formUrl: url }).problems.filter((p) => p.includes("link"))).toEqual([]);
    expect(checkReply(`Here's the form: https://${url}`, { channel: "sms", formUrl: url }).problems.filter((p) => p.includes("link"))).toEqual([]);
    expect(checkReply(`Here's the form: https://evil.example/a/x`, { channel: "sms", formUrl: url }).problems.some((p) => p.includes("link"))).toBe(true);
  });
});

describe("telegram", () => {
  it("keeps only the driver's own words from an email reply", () => {
    const said = "Yes, tell me more.\n\nOn Mon, 16 Nov 2026 at 10:05, Tyler Thomas <tyler@x.com>\nwrote:\n\n> Hi George,\n> I run Global Runners";
    expect(ownWords(said)).toBe("Yes, tell me more.");
  });
});

describe("submitted application", () => {
  const lead = {
    first_name: "George", last_name: "B", phone: "+17203197167", email: "g@x.com", zip: "89101", locale: "en",
    driver_type: "solo", run_types: ["otr"], has_team_partner: null, has_cdl_a: true, experience: "3-5",
    endorsements: ["hazmat"], moving_violations: "0", accidents: "0", dui: false, drug_test_issue: false, work_authorized: true, over_21: true, sms_consent: true,
  };
  it("rebuilds answers for older submissions", () => {
    const a = answersFromLead(lead);
    expect(a.find((x) => x.label === "CDL-A experience")?.value).toBe("3–5 yrs");
    expect(a.find((x) => x.label === "Runs")?.value).toBe("OTR");
    expect(a.some(isConcern)).toBe(false);
  });
  it("flags answers Ken should check", () => {
    const a = answersFromLead({ ...lead, dui: true, has_cdl_a: false, experience: "lt1", moving_violations: "4plus" });
    expect(a.filter(isConcern).map((x) => x.label)).toEqual(["Valid CDL-A", "CDL-A experience", "Moving violations (3 yrs)", "Ever had a DUI"]);
  });
});

describe("a yes always gets the form", () => {
  it("adds the link to Shuai's reply, drops the question, keeps the signature last", async () => {
    const { withFormLink } = await import("@/lib/agent/engine");
    const shuai = "Hi Shuai,\n\nYeah, here are the numbers. Solo is 60 to 70 cents a mile.\n\nWant me to send the short form so they can call you?\n\nClaudia\nGlobal Runners Logistics";
    const out = withFormLink(shuai, "globalrunnerslogistics.com/a/zxjJc2", "email");
    expect(out).toContain("globalrunnerslogistics.com/a/zxjJc2");
    expect(out).not.toMatch(/want me to send/i);
    expect(out.endsWith("Claudia\nGlobal Runners Logistics")).toBe(true);
    expect(out).not.toMatch(/\n{3,}/);
    expect(withFormLink("ok cool", "x.com/a/abc123", "sms")).toBe("ok cool here's the short form, takes about 2 min: x.com/a/abc123");
  });
});

describe("yes detector (code-level, can't be talked out of it)", () => {
  const quoteEN = "\n\nOn Mon, 16 Nov 2026 at 13:56, Adrian Hall <adrian@x.com>\nwrote:\n\n> Want the pay numbers? Just reply \"yes\"\n> Not interested? Reply \"stop\" and I won't email again.";
  const quoteZH = "\n\nAdrian Hall <adrian@corvooriginscharge.com>于2026年11月17日 周二03:28写道：\n\n> Hi Shuai,\n> Not interested? Reply \"stop\"";
  it("catches every common yes, even with the quoted email below it", async () => {
    const { looksLikeYes } = await import("@/lib/agent/engine");
    for (const y of ["Yes", "yes!", "Yeah", "yep", "Sure", "ok", "Okay send it", "Interested", "I'm interested", "I am very interested", "tell me more", "Yes, what's the pay?", "yes please send details", "Sí", "si claro", "me interesa", "How do I apply?", "sounds good", "Yes I am interested."])
      for (const q of ["", quoteEN, quoteZH]) expect(looksLikeYes(y + q), y).toBe(true);
  });
  it("never treats a no, a stop or a plain question as yes", async () => {
    const { looksLikeYes } = await import("@/lib/agent/engine");
    for (const n of ["No", "not interested", "I'm not interested", "No thanks", "stop", "unsubscribe", "remove me", "what's the home time?", "who is this?", "I have my own truck", "nah"])
      expect(looksLikeYes(n + quoteEN), n).toBe(false);
  });
  it("keeps only the driver's own words", async () => {
    const { ownReply } = await import("@/lib/agent/engine");
    expect(ownReply("Yes" + quoteEN)).toBe("Yes");
    expect(ownReply("Yes" + quoteZH)).toBe("Yes");
    expect(ownReply("Sí\n\nEl lun, 16 nov 2026 a las 13:56, Adrian escribió:\n> hola")).toBe("Sí");
    expect(ownReply("ok\n\nFrom: Adrian Hall\nSent: Monday")).toBe("ok");
  });
});

describe("hand-off words: only the driver's own request for a person", () => {
  const david = "What's the pay?\n\nOn Tue, Nov 17, 2026 at 12:11 PM Ashley Wright <ashley@motuscosmichinge.com>\nwrote:\n\n> Hey David,\n> Or call or text Ken, our hiring manager, at (312) 975-3377.";
  it("doesn't hand off because our quoted email says 'hiring manager'", async () => {
    const { HUMAN_WORDS, ownReply } = await import("@/lib/agent/engine");
    expect(HUMAN_WORDS.test(ownReply(david))).toBe(false);
    expect(HUMAN_WORDS.test("I was a fleet manager for 3 years")).toBe(false);
  });
  it("still hands off real requests and legal words", async () => {
    const { HUMAN_WORDS } = await import("@/lib/agent/engine");
    for (const t of ["can I talk to a manager", "let me speak with a real person", "have your manager call me", "I'll get a lawyer", "this is harassment", "I'll report you"]) expect(HUMAN_WORDS.test(t), t).toBe(true);
  });
});
