import "server-only";
import { callJson } from "./http";

/** DeepSeek (OpenAI-compatible). JSON mode keeps outputs parseable; the system prompt prefix is stable for caching. */
export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

// USD per 1M tokens (flash). Used only for the cost readout.
const PRICE = { inHit: 0.028, inMiss: 0.14, out: 0.28 };

export async function chatJson(messages: ChatMsg[], opts: { temperature?: number; maxTokens?: number } = {}) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY is not set");
  const model = process.env.DEEPSEEK_MODEL || "deepseek-flash";
  const started = Date.now();
  const r = await callJson<{
    choices: { message: { content: string } }[];
    usage?: { prompt_tokens: number; completion_tokens: number; prompt_cache_hit_tokens?: number; prompt_cache_miss_tokens?: number };
  }>("deepseek", "https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature: opts.temperature ?? 0.7, max_tokens: opts.maxTokens ?? 900, response_format: { type: "json_object" } }),
    timeoutMs: 45000,
    retries: 1,
  });
  const u = r.usage;
  const hit = u?.prompt_cache_hit_tokens ?? 0;
  const miss = u?.prompt_cache_miss_tokens ?? (u?.prompt_tokens ?? 0) - hit;
  const cost = u ? (hit * PRICE.inHit + miss * PRICE.inMiss + u.completion_tokens * PRICE.out) / 1e6 : 0;
  return {
    content: r.choices?.[0]?.message?.content ?? "",
    model,
    tokensIn: u?.prompt_tokens ?? 0,
    tokensOut: u?.completion_tokens ?? 0,
    costUsd: Number(cost.toFixed(5)),
    latencyMs: Date.now() - started,
  };
}
