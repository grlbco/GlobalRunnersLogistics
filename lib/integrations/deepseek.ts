import "server-only";
import { callJson } from "./http";

/**
 * DeepSeek (OpenAI-compatible). V4 models "think" by default, which eats the output budget and
 * truncates JSON — so thinking is switched off for these short conversational calls.
 */
export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

// USD per 1M tokens (flash). Used only for the cost readout.
const PRICE = { inHit: 0.028, inMiss: 0.14, out: 0.28 };

async function chat(messages: ChatMsg[], opts: { json: boolean; temperature?: number; maxTokens?: number }) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY is not set");
  const model = process.env.DEEPSEEK_MODEL || "deepseek-flash";
  const started = Date.now();
  const r = await callJson<{
    choices: { message: { content: string | null }; finish_reason?: string }[];
    usage?: { prompt_tokens: number; completion_tokens: number; prompt_cache_hit_tokens?: number; prompt_cache_miss_tokens?: number };
  }>("deepseek", "https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.8,
      max_tokens: opts.maxTokens ?? 1500,
      thinking: { type: "disabled" },
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
    timeoutMs: 45000,
    retries: 1,
  });
  const u = r.usage;
  const hit = u?.prompt_cache_hit_tokens ?? 0;
  const miss = u?.prompt_cache_miss_tokens ?? (u?.prompt_tokens ?? 0) - hit;
  const cost = u ? (hit * PRICE.inHit + miss * PRICE.inMiss + u.completion_tokens * PRICE.out) / 1e6 : 0;
  return {
    content: r.choices?.[0]?.message?.content ?? "",
    finish: r.choices?.[0]?.finish_reason ?? null,
    model,
    tokensIn: u?.prompt_tokens ?? 0,
    tokensOut: u?.completion_tokens ?? 0,
    costUsd: Number(cost.toFixed(5)),
    latencyMs: Date.now() - started,
  };
}

export const chatJson = (messages: ChatMsg[], opts: { temperature?: number; maxTokens?: number } = {}) => chat(messages, { ...opts, json: true });
export const chatText = (messages: ChatMsg[], opts: { temperature?: number; maxTokens?: number } = {}) => chat(messages, { ...opts, json: false });

/** Pulls the first JSON object out of a reply (handles ```json fences and stray text). */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {}
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
  throw new Error("no JSON object found");
}
