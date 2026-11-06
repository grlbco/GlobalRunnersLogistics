import { pay } from "@/content/facts";

/**
 * Answers code gives without asking the AI, because getting them wrong costs the most.
 * Plain logic with no database, so they can be tested. Change the wording here, not in the prompt.
 */
export const DISCLOSURE_TEXT = "This is the AI assistant for Global Runners Logistics. Reply STOP to opt out.";
export const DISCLOSURE_EMAIL = "I'm the AI assistant for Global Runners Logistics. Ken and the team can step in anytime.";

const PAY_ANSWER = [
  `It's per mile, paid every ${pay.payday}. Plus $${pay.layover} layover pay and a $${pay.anniversaryBonus.toLocaleString("en-US")} bonus each year you're with us.`,
  "Ken goes over the exact rate on the call, it depends on the run.",
];
const IDENTITY_ANSWER = ["I'm an AI assistant, I help Ken's team with texts and emails. Ken's a real person and he calls drivers himself once they fill out the form."];

const IS_PAY = /\b(how much|what).{0,24}\b(pay|paying|cpm|salary|rate|make)\b|\bwhat'?s? (is )?the (pay|rate)\b|\bcents? (a|per) mile\b|^\s*(pay|cpm|rate)\s*\??\s*$/i;
const IS_IDENTITY = /\b(are|is) (you|this|u)\b.{0,16}\b(bot|robot|ai|a\.i\.|human|real person|real|automated)\b|\b(am i|i'?m) (talking|texting|speaking) (to|with) .{0,12}\b(bot|robot|ai|human|real person)\b/i;

export const FIXED_REPEAT_REASON = { pay: "Asked about pay again after the standard answer", identity: "Asked again whether this is a real person" };

export type FixedAnswer = { intent: "pay" | "identity"; replies: string[] };

/** Only short, plain questions: anything longer may say more than this one answer covers, so the AI reads it. */
export function fixedAnswer(driverText: string): FixedAnswer | null {
  const t = driverText.trim();
  if (!t || t.length > 90) return null;
  if (IS_IDENTITY.test(t)) return { intent: "identity", replies: IDENTITY_ANSWER };
  if (IS_PAY.test(t)) return { intent: "pay", replies: PAY_ANSWER };
  return null;
}

/** The first message on a channel says it's AI. Email adds a line, a text gets its own message with the opt-out. */
export function withDisclosure(parts: string[], channel: "email" | "sms", firstOnChannel: boolean, alreadySaysAi = false): string[] {
  if (!firstOnChannel || alreadySaysAi || !parts.length) return parts;
  if (channel === "sms") return [DISCLOSURE_TEXT, ...parts];
  const [first, ...rest] = parts;
  return [`${first}\n\n${DISCLOSURE_EMAIL}`, ...rest];
}
