import { describe, expect, it } from "vitest";
import { normPhone, validate, fieldText, settingsText, TEMPLATES, schemaZ, newField, type FormField } from "@/lib/formbuilder/schema";

describe("phone numbers", () => {
  it.each([["(702) 555-0199", "+17025550199"], ["702.555.0199", "+17025550199"], ["+1 702 555 0199", "+17025550199"], ["17025550199", "+17025550199"]])("normalizes %s", (a, b) => expect(normPhone(a)).toBe(b));
  it.each(["555-0199", "123-456-7890", "abc", ""])("rejects %j", (a) => expect(normPhone(a)).toBeNull());
});

describe("form validation (same on the phone and the server)", () => {
  const fields: FormField[] = [
    { id: "n", type: "text", label: "Name", required: true },
    { id: "p", type: "phone", label: "Cell", required: true },
    { id: "e", type: "email", label: "Email", required: false },
    { id: "x", type: "radio", label: "Exp", required: true, options: ["1-2 years", "3-5 years"] },
    { id: "y", type: "yesno", label: "CDL?", required: true },
    { id: "c", type: "consent", label: "consent", required: false },
    { id: "num", type: "number", label: "Year", required: false, validation: { min: 1990, max: 2030 } },
  ];
  it("passes a good answer set", () => expect(validate(fields, { n: "George", p: "(702) 555-0199", x: "3-5 years", y: "Yes", c: true })).toEqual({}));
  it("flags missing required answers", () => expect(Object.keys(validate(fields, {}))).toEqual(["n", "p", "x", "y"]));
  it("rejects a bad phone and email", () => {
    const e = validate(fields, { n: "a", p: "12", e: "nope", x: "3-5 years", y: "No" });
    expect(e.p).toBeTruthy();
    expect(e.e).toBeTruthy();
  });
  it("rejects options that aren't on the form (tampering)", () => expect(validate(fields, { n: "a", p: "7025550199", x: "10 years", y: "Maybe" })).toMatchObject({ x: expect.any(String), y: expect.any(String) }));
  it("consent is never required unless set", () => expect(validate(fields, { n: "a", p: "7025550199", x: "1-2 years", y: "Yes", c: false }).c).toBeUndefined());
  it("checks number ranges", () => expect(validate(fields, { n: "a", p: "7025550199", x: "1-2 years", y: "Yes", num: 1980 }).num).toBe("At least 1990"));
});

describe("templates and Spanish", () => {
  it("every template is a valid schema", () => {
    for (const t of Object.values(TEMPLATES)) expect(schemaZ.safeParse(t.schema).success).toBe(true);
  });
  it("every template asks for a phone", () => {
    for (const t of Object.values(TEMPLATES)) expect(t.schema.pages.some((p) => p.fields.some((f) => f.type === "phone"))).toBe(true);
  });
  it("Spanish options show Spanish but store English", () => {
    const f: FormField = { id: "x", type: "radio", label: "Experience", required: true, options: ["Under 1 year", "5+ years"], es: { label: "Experiencia", options: ["Menos de 1 año", "5+ años"] } };
    const t = fieldText(f, "es");
    expect(t.label).toBe("Experiencia");
    expect(t.options).toEqual([["Under 1 year", "Menos de 1 año"], ["5+ years", "5+ años"]]);
    expect(fieldText(f, "en").options[0]).toEqual(["Under 1 year", "Under 1 year"]);
  });
  it("Spanish consent uses the official Spanish text", () => expect(fieldText(newField("consent"), "es").label).toMatch(/^Acepto recibir/));
  it("falls back to English when Spanish is missing", () => expect(settingsText({ title: "Hi" }, "es").title).toBe("Hi"));
});
