#!/usr/bin/env node
/**
 * Registers the production webhooks (Quo + Instantly) for GRL Command. Safe to run twice: skips existing ones.
 *   node scripts/register-webhooks.mjs https://globalrunnerslogistics.com
 * Reads keys from .env.local (or the environment). Prints the secrets to put in Vercel.
 */
import fs from "node:fs";
import crypto from "node:crypto";

const base = (process.argv[2] || "").replace(/\/$/, "");
if (!/^https:\/\//.test(base)) {
  console.error("Usage: node scripts/register-webhooks.mjs https://your-domain.com");
  process.exit(1);
}
const env = { ...process.env };
if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}
const out = [];

async function quo() {
  if (!env.QUO_API_KEY) return console.log("Quo: QUO_API_KEY missing, skipped");
  const url = `${base}/api/hooks/quo`;
  const h = { Authorization: env.QUO_API_KEY, "Quo-Api-Version": "2026-03-30", "Content-Type": "application/json" };
  const list = await fetch("https://api.quo.com/webhooks", { headers: h }).then((r) => r.json()).catch(() => ({}));
  if ((list.data ?? []).some((w) => w.url === url)) return console.log(`Quo: webhook already exists for ${url}`);
  const r = await fetch("https://api.quo.com/webhooks", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      url,
      label: "GRL Command",
      resourceIds: ["*"],
      events: ["message.received", "message.delivered", "call.completed", "call.summary.completed", "call.transcript.completed"],
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return console.log(`Quo: failed (${r.status})`, JSON.stringify(j).slice(0, 400));
  console.log(`Quo: created webhook ${j.data?.id} → ${url}`);
  if (j.data?.key) out.push(`QUO_WEBHOOK_SECRET=${j.data.key}`);
}

async function instantly() {
  if (!env.INSTANTLY_API_KEY) return console.log("Instantly: INSTANTLY_API_KEY missing, skipped");
  const url = `${base}/api/hooks/instantly`;
  const h = { Authorization: `Bearer ${env.INSTANTLY_API_KEY}`, "Content-Type": "application/json" };
  const list = await fetch("https://api.instantly.ai/api/v2/webhooks?limit=100", { headers: h }).then((r) => r.json()).catch(() => ({}));
  if ((list.items ?? []).some((w) => w.target_hook_url === url)) return console.log(`Instantly: webhook already exists for ${url}`);
  const secret = env.INSTANTLY_WEBHOOK_SECRET || crypto.randomBytes(24).toString("base64url");
  const r = await fetch("https://api.instantly.ai/api/v2/webhooks", {
    method: "POST",
    headers: h,
    body: JSON.stringify({ name: "GRL Command", target_hook_url: url, event_type: "all_events", headers: { "x-webhook-secret": secret } }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return console.log(`Instantly: failed (${r.status})`, JSON.stringify(j).slice(0, 400));
  console.log(`Instantly: created webhook ${j.id} → ${url}`);
  if (!env.INSTANTLY_WEBHOOK_SECRET) out.push(`INSTANTLY_WEBHOOK_SECRET=${secret}`);
}

await quo();
await instantly();
if (out.length) {
  console.log("\nAdd these to Vercel (Settings → Environment Variables) and redeploy:");
  for (const l of out) console.log(l);
}
