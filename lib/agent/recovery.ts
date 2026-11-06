/** Rules for when the assistant fails or goes quiet. Plain logic with no database, so they can be tested. */
export const MAX_TRIES = 3;
export const RESCUE_AFTER_MS = 15 * 60_000;
export const FOLLOWUP_LEASE_MS = 10 * 60_000;
export const REPLY_WINDOW_MS_FOR_HOLD = 2 * 3600_000;
export const HOLDING_TEXT = "Got your message, thanks. A person from Global Runners will follow up with you soon.";

/** Retrying can't fix a bad key, an empty balance or a rejected request, so those go to a person at once. */
export function failureKind(e: unknown): "retry" | "person" {
  const status = (e as { status?: unknown } | null)?.status;
  if (typeof status === "number") return status === 429 || status >= 500 ? "retry" : "person";
  return e instanceof Error && /API_KEY is not set/.test(e.message) ? "person" : "retry";
}

/** Run outcomes that already settled the message: a task exists, or staying silent was decided and recorded. */
const SETTLED = new Set(["no_reply", "handed_off", "unsubscribed"]);

/**
 * Every driver message must end in a reply, a human task or a recorded decision to stay silent.
 * True when none of those happened in time.
 */
export function needsRescue(c: {
  lastInboundAt: string; lastOutboundAt: string | null;
  /** A reply, draft or queued run is already on its way. */
  waiting: boolean;
  taskSinceInbound: boolean; lastRunAction: string | null; autoReply: boolean; now: Date;
}) {
  const inbound = new Date(c.lastInboundAt).getTime();
  if (c.now.getTime() - inbound < RESCUE_AFTER_MS) return false;
  if (c.lastOutboundAt && new Date(c.lastOutboundAt).getTime() >= inbound) return false;
  if (c.autoReply || c.waiting || c.taskSinceInbound) return false;
  return !(c.lastRunAction && SETTLED.has(c.lastRunAction));
}
