/**
 * The last check before anything leaves. Plain rules with no AI and no database, so every message
 * is judged the same way and the rules can be tested. outbox.ts loads the facts and acts on the result.
 */
export const REPLY_WINDOW_MS = 2 * 3600_000;
export const MAX_PROACTIVE_TEXTS_24H = 3;

function isQuietIn(zone: string, at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", hour12: false, weekday: "short" }).formatToParts(at);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 12) % 24;
  const opens = parts.find((p) => p.type === "weekday")?.value === "Sun" ? 12 : 9;
  return hour < opens || hour >= 20;
}

/**
 * Texts we start: 9am-8pm driver time, Sunday from noon.
 * Unknown zone: only when that holds on both coasts of the lower 48.
 */
export function inQuietHours(tz: string | null, at = new Date()) {
  if (tz) return isQuietIn(tz, at);
  return isQuietIn("America/New_York", at) || isQuietIn("America/Los_Angeles", at);
}

export type GateInput = {
  channel: "email" | "sms";
  author: "agent" | "human" | "workflow";
  /** A person wrote it or approved this exact message. */
  approvedByPerson: boolean;
  isReply: boolean;
  createdAt: string;
  contact: {
    doNotContact: boolean; emailConsent: boolean; smsConsent: boolean;
    email: string | null; phone: string | null; timezone: string | null;
    agentMode: string; pausedUntil: string | null;
  };
  suppressed: boolean;
  lastInboundAt: string | null;
  proactiveTexts24h: number;
  now: Date;
};

export type GateResult =
  | { action: "send" }
  /** Try again later (quiet hours, daily limit). */
  | { action: "wait"; reason: string }
  /** No longer wanted: the situation changed, so this isn't an error. */
  | { action: "cancel"; reason: string }
  /** Can't be sent and someone should see why. */
  | { action: "fail"; reason: string };

export function gate(g: GateInput): GateResult {
  const c = g.contact;
  const byPerson = g.author === "human" || g.approvedByPerson;
  const time = (iso: string) => new Date(iso).getTime();

  if (c.doNotContact) return byPerson ? { action: "fail", reason: "Contact is do-not-contact" } : { action: "cancel", reason: "Contact is do-not-contact" };

  if (!byPerson) {
    if (c.agentMode !== "auto") return { action: "cancel", reason: "A person is handling this driver" };
    if (c.pausedUntil && time(c.pausedUntil) > g.now.getTime()) return { action: "cancel", reason: "A person replied recently" };
    if (g.author === "agent" && g.lastInboundAt && time(g.lastInboundAt) > time(g.createdAt)) return { action: "cancel", reason: "The driver wrote again after this was prepared" };
  }

  if (g.channel === "email") {
    if (!c.emailConsent) return { action: "fail", reason: "Email is off for this contact (unsubscribed)" };
    if (g.suppressed) return { action: "fail", reason: "Email is on the opt-out list" };
    return { action: "send" };
  }

  if (!c.phone) return { action: "fail", reason: "No phone number on this contact" };
  if (!c.smsConsent) return { action: "fail", reason: "No text consent yet (driver must text us first or tick the form box)" };
  if (g.suppressed) return { action: "fail", reason: "Number is on the opt-out list" };

  if (!byPerson) {
    const freshReply = g.isReply && !!g.lastInboundAt && g.now.getTime() - time(g.lastInboundAt) < REPLY_WINDOW_MS;
    if (!freshReply) {
      if (inQuietHours(c.timezone, g.now)) return { action: "wait", reason: "Waits for texting hours in the driver's time zone" };
      if (g.proactiveTexts24h >= MAX_PROACTIVE_TEXTS_24H) return { action: "wait", reason: `Waits: already ${MAX_PROACTIVE_TEXTS_24H} texts in 24 hours` };
    }
  }
  return { action: "send" };
}
