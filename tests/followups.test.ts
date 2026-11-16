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
