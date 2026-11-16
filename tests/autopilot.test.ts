import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/crm/admin", () => ({ adminDb: () => ({}) }));

import { CHASE, POSITIVE_INTENTS } from "@/lib/agent/engine";
import { systemPrompt, buildMessages } from "@/lib/agent/prompt";
import { US_PHONE } from "@/lib/forms";
import { shortCompany, titleCase } from "@/lib/crm/campaigns";
import { TIERS } from "@/lib/crm/stages";

describe("reply-to-application autopilot", () => {
  it("chases the form 7 times over 10 days, then Nurture", () => {
    expect(CHASE).toHaveLength(7);
    const hours = CHASE.reduce((t, s) => t + s.gapH, 0);
    expect(Math.round(hours / 24)).toBe(10);
    expect(CHASE[0]).toEqual({ gapH: 2, ch: "both" });
  });

  it("treats yes, ready and call requests as interest", () => {
    expect(POSITIVE_INTENTS).toEqual(expect.arrayContaining(["interested", "ready", "call_request"]));
  });

  it("Claudia: named, honest about being an AI, English only, any-language yes", () => {
    const p = systemPrompt();
    expect(p).toMatch(/You are Claudia, the AI assistant/);
    expect(p).toMatch(/Always write in English/);
    expect(p).toMatch(/sí/);
    expect(p).toMatch(/I'm Claudia, an AI assistant/);
    expect(p).not.toMatch(/Spanish from them = Spanish back/);
  });

  it("asks for texts with the email only when the driver is interested", () => {
    const msgs = buildMessages({ name: "Dan", stage: "replied", channel: "email", smsConsent: false, formUrl: "https://x/apply/driver?t=1", form: { sent: false, opened: false, step: 0, completed: false }, memory: { facts: {} }, turns: [], trigger: "email_received", alsoText: true });
    const task = msgs.at(-1)!.content;
    expect(task).toMatch(/ONLY IF they're interested/);
    expect(task).toMatch(/Claudia from Global Runners/);
  });

  it("accepts only real US phone numbers", () => {
    expect(US_PHONE.test("7029753377")).toBe(true);
    expect(US_PHONE.test("+17029753377")).toBe(true);
    expect(US_PHONE.test("1234567890")).toBe(false); // area code can't start with 1
    expect(US_PHONE.test("7021234567")).toBe(false); // exchange can't start with 1
    expect(US_PHONE.test("702555012")).toBe(false);
  });

  it("cleans company and city for {{companyShort}} and {{cityName}}", () => {
    expect(shortCompany("ATI CARRIERS INC")).toBe("Ati Carriers");
    expect(shortCompany("JDF TRUCKING LLC")).toBe("JDF Trucking");
    expect(shortCompany("DOUBLE B & A TOWING AND TRANSPORTING")).toBe("Double B & A Towing and Transporting");
    expect(titleCase("WAKE FOREST")).toBe("Wake Forest");
  });

  it("names the new tiers", () => {
    expect(TIERS[1]).toBe("West core");
    expect(TIERS[2]).toBe("Other states");
  });
});
