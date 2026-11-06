import { allowedNumbers } from "./knowledge";

/** Code-level guardrails on every reply. Any failure → retry once, then hand to a person. */
const BANNED = [
  /\b(as an ai|as an a\.i\.|language model|large language)\b/i, // cliché openers ("I'm an AI assistant" when asked is fine)
  /\b(real person here|i'?m (a |an )?(real )?(human|person)\b|i am (a |an )?(real )?(human|person)\b|not a (bot|robot)|i'?m not (a |an )?(bot|robot|ai)\b|a real human)/i, // never claim to be human
  /\b(great question|i hope this helps|feel free to|don'?t hesitate)\b/i,
  /[—–;]/, // em/en dashes and semicolons read robotic in texts
  /\b(it'?s|this is) not (just )?[^.,!?]{1,40}, (it'?s|but)\b/i, // "it's not X, it's Y"
  /\bnot just\b[^.!?]{1,40}\bbut\b/i,
  /\b(absolutely|certainly|rest assured|seamless|journey|reach out|i understand your concern|thrilled)\b/i,
  /\bguarantee(d)?\b/i,
  /\b(no|not|don'?t|doesn'?t|isn'?t|never)\b[^.!?\n]{0,30}\b(minimum|hazmat|tanker|endorsement)\b/i, // unconfirmed: never denied
  /\b(you'?re|you are) (hired|approved|qualified|in)\b|\byou qualify\b|\bi promise\b|\bwe promise\b/i, // hiring is Ken's call
  /(^|\n)\s*-*\s*Ken(\s*(\/|from|at)[^\n]*)?\s*$/i, // signed as Ken: the assistant isn't Ken
  /\b(i'?ll|i will|let me) (give you a (call|ring)|call you|ring you)\b/i, // only Ken calls
  /\b(green card|citizen(ship)?|immigration|visa status|undocumented)\b/i,
  /\b(leverage|synergy|opportunity awaits|exciting opportunity)\b/i,
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, // emojis
];

export type CheckResult = { ok: boolean; problems: string[] };

export function checkReply(text: string, ctx: { channel: "email" | "sms"; formUrl: string; extraAllowed?: string[] }): CheckResult {
  const problems: string[] = [];
  const max = ctx.channel === "sms" ? 320 : 1200;
  if (!text.trim()) problems.push("empty reply");
  if (text.length > max) problems.push(`too long (${text.length} > ${max} chars)`);
  for (const re of BANNED) if (re.test(text)) problems.push(`banned wording: ${re.source.slice(0, 40)}`);

  const urls = text.match(/https?:\/\/\S+|www\.\S+/gi) ?? [];
  for (const u of urls) if (!u.replace(/[).,!?]+$/, "").startsWith(ctx.formUrl)) problems.push(`link not allowed: ${u}`);

  const allowed = allowedNumbers([ctx.formUrl, ...(ctx.extraAllowed ?? [])]);
  const withoutUrls = text.replace(/https?:\/\/\S+/g, "");
  for (const m of withoutUrls.matchAll(/\$?\d[\d,.]*\s*(¢|cents?|cpm|per mile|\/mi|k\b|%)?/gi)) {
    const raw = m[0].trim();
    const num = raw.replace(/[^\d.]/g, "").replace(/\.$/, "");
    if (!num) continue;
    if (/¢|cent|cpm|per mile|\/mi|%/i.test(raw)) {
      problems.push(`rate/percent not allowed: ${raw}`);
      continue;
    }
    if (!allowed.has(num) && !allowed.has(num.replace(/\.0+$/, ""))) problems.push(`number not in facts: ${raw}`);
  }
  return { ok: problems.length === 0, problems };
}
