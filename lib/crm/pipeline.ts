import type { Stage } from "./stages";

/**
 * The AI proposes a stage and these rules decide. Plain logic with no database, so it can be tested.
 * When actors conflict: opt-outs and bounces win, then system facts, then people, then the AI.
 */
const RANK: Record<Stage, number> = {
  new: 0, contacted: 1, replied: 2, interested: 3, form_sent: 4, chasing: 4.5, applied: 5, qualified: 6, sent_to_ken: 7, hired: 8,
  nurture: 1.5, not_fit: 9, not_interested: 9, unsubscribed: 10, bounced: 10,
};
const TERMINAL = new Set<Stage>(["hired", "not_fit", "unsubscribed", "bounced"]);

/** Automatic moves only go forward; opt-out/bounce always win. Humans can move anywhere (via the UI). */
export function advance(current: Stage, next: Stage): Stage {
  if (next === "unsubscribed" || next === "bounced") return next;
  if (TERMINAL.has(current)) return current;
  return RANK[next] > RANK[current] ? next : current;
}

export type ActorType = "system" | "ai" | "human";
export const actorType = (actor: string): ActorType => (actor.startsWith("user:") ? "human" : actor === "agent" ? "ai" : "system");

/** Everything the AI may do to a card. Not a fit, form and hire stages are never its call. */
export const AI_STAGES: readonly Stage[] = ["interested", "not_interested", "nurture"];
/** Things that really happened: they apply even when a person has locked the card. */
const SYSTEM_FACTS: readonly Stage[] = ["form_sent", "applied", "unsubscribed", "bounced"];

const normalize = (s: string) => s.toLowerCase().replace(/[“”"'’`]/g, "").replace(/\s+/g, " ").trim();
/** True when the quote is really in what the driver wrote, so the AI can't invent its evidence. */
export function quoteFound(quote: string | null | undefined, driverText: string | null | undefined) {
  if (!quote || !driverText) return false;
  const q = normalize(quote);
  return q.length >= 2 && normalize(driverText).includes(q);
}

export type MoveVerdict =
  | { apply: true; to: Stage }
  /** Nothing to record: already there, or a routine event that doesn't move this card forward. */
  | { apply: false; quiet: true }
  | { apply: false; quiet: false; reason: string };

export function decideMove(m: {
  current: Stage; to: Stage; actor: ActorType; locked: boolean;
  /** System only: may move backward, e.g. into Nurture when follow-ups run out. */
  force?: boolean;
  quote?: string | null; driverText?: string | null;
}): MoveVerdict {
  if (m.to === m.current) return { apply: false, quiet: true };
  if (m.to === "unsubscribed" || m.to === "bounced") return { apply: true, to: m.to };
  if (m.actor === "human") return { apply: true, to: m.to };

  if (m.actor === "ai") {
    if (m.locked) return { apply: false, quiet: false, reason: "A person locked this card" };
    if (!AI_STAGES.includes(m.to)) return { apply: false, quiet: false, reason: `The AI can't move a card to ${m.to}` };
    // Stopping outreach applies straight away: going quiet by mistake is cheap, pestering someone isn't.
    if (m.to === "interested" && !quoteFound(m.quote, m.driverText)) return { apply: false, quiet: false, reason: "The quoted words aren't in the driver's message" };
  } else if (m.locked && !SYSTEM_FACTS.includes(m.to)) {
    return { apply: false, quiet: true };
  }

  if (m.force && m.actor === "system" && !TERMINAL.has(m.current) && m.current !== "applied") return { apply: true, to: m.to };
  const to = advance(m.current, m.to);
  return to === m.current ? { apply: false, quiet: true } : { apply: true, to };
}
