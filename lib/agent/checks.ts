import { allowedNumbers } from "./knowledge";

/** Code-level guardrails on every reply. Any failure → retry once, then hand to a person. */
const BANNED = [
  /\b(as an )?(ai|a\.i\.|artificial intelligence|language model|chatbot|bot|automated|assistant)\b/i,
  /\bguarantee(d)?\b/i,
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
