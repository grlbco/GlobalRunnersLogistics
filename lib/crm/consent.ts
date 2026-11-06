/**
 * When may we text? A phone number alone is never permission. Plain logic with no database, so it can be tested.
 * Whether an emailed "yes" counts as written consent is an open question for counsel.
 */
const ASKED_TO_BE_TEXTED = /\b(text|txt|sms)\s+(me|is fine|works|is better|ok)\b|\byou can text\b|\bok(ay)?\s+to\s+text\b/i;
const AGREES = /\b(yes|yeah|yep|yup|ok|okay|sure|si|sí)\b/i;
const ONLY_AGREES = /^\s*(yes|y|yeah|yep|yup|ok|okay|sure|si|sí)\b[\s.!]*(please|thanks|thank you)?[\s.!]*$/i;
const CELL = /(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})\b/;

/** An email reply (the driver's own words only). A number with no "yes" is saved, but isn't permission. */
export function consentFromEmail(own: string, hasPhoneOnFile: boolean): { cell: string | null; consent: boolean } {
  const m = own.match(CELL);
  const cell = m ? `+1${m[1]}${m[2]}${m[3]}` : null;
  const asked = ASKED_TO_BE_TEXTED.test(own);
  return { cell, consent: (asked && (!!cell || hasPhoneOnFile)) || (!!cell && AGREES.test(own)) };
}

/** A text: "yes" counts only when our last message asked about texting, or they tell us to text them. */
export function consentFromText(body: string, lastOutbound: string | null): boolean {
  if (ASKED_TO_BE_TEXTED.test(body)) return true;
  return ONLY_AGREES.test(body) && !!lastOutbound && /\b(text|texting|txt)\b/i.test(lastOutbound);
}
