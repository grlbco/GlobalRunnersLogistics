/**
 * Auto-send is earned, per kind of message, from drafts people actually reviewed.
 * Plain logic with no database, so it can be tested. The numbers are a starting suggestion, not an industry standard:
 * with no errors in 100 reviews, the true error rate is probably under about 3%.
 */
export const GRADUATE_AT = 100;
export const MAX_CHANGED_SHARE = 0.1;

export const RISK_GROUPS = [
  { key: "fixed", label: "Fixed answers", hint: "Pay and \"are you a bot?\" answers written in code" },
  { key: "followups", label: "Follow-ups", hint: "Messages it starts itself" },
  { key: "questions", label: "Answers to questions", hint: "Written from the facts sheet" },
  { key: "general", label: "Everything else", hint: "Interest, small talk, sending the form" },
] as const;
export type RiskGroup = (typeof RISK_GROUPS)[number]["key"];

export function riskGroup(m: { trigger: string; intent: string; fixed: boolean }): RiskGroup {
  if (m.fixed) return "fixed";
  if (m.trigger === "followup" || m.trigger === "form_abandoned" || m.trigger === "interest_label") return "followups";
  return ["question", "objection", "owner_operator", "other"].includes(m.intent) ? "questions" : "general";
}

/** The group is kept in the outbox row's unique key, so a review can be credited to it later. */
export const groupKey = (group: RiskGroup, id: string) => `agent:${group}:${id}`;
export const groupFromKey = (key: string | null | undefined): RiskGroup | null => {
  const g = key?.split(":")[1];
  return RISK_GROUPS.some((x) => x.key === g) ? (g as RiskGroup) : null;
};

export function canAutoSend(p: { group: RiskGroup; draftMode: boolean; factsApproved: boolean; autoGroups: readonly string[] }) {
  if (!p.factsApproved) return false; // never send on facts nobody has signed off
  return !p.draftMode || p.autoGroups.includes(p.group);
}

export function reviewProgress(group: RiskGroup, reviews: { group?: string | null; edited?: boolean; discarded?: boolean }[]) {
  const mine = reviews.filter((r) => r.group === group);
  const changed = mine.filter((r) => r.edited || r.discarded).length;
  const clean = mine.length - changed;
  // Fixed answers never vary, so they don't need a track record, just an approved facts sheet.
  const ready = group === "fixed" || (clean >= GRADUATE_AT && changed / Math.max(1, mine.length) <= MAX_CHANGED_SHARE);
  return { reviewed: mine.length, clean, changed, ready };
}

type Person = { id: string; first_name: string | null; last_name: string | null; phone: string | null; cell_phone: string | null; company_name: string | null; state: string | null };

/** Why two records might be the same driver. They're only flagged, never merged: one phone can serve several drivers. */
export function duplicateReason(a: Person, b: Person): string | null {
  if (a.id === b.id) return null;
  const phones = new Set([a.phone, a.cell_phone].filter(Boolean));
  if ([b.phone, b.cell_phone].some((p) => p && phones.has(p))) return "Same phone number";
  const same = (x: string | null, y: string | null) => !!x && !!y && x.trim().toLowerCase() === y.trim().toLowerCase();
  if (same(a.first_name, b.first_name) && same(a.last_name, b.last_name) && same(a.state, b.state)) return "Same name and state";
  return null;
}
