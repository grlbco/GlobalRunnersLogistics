"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { handleSubmission, type SubmitResult } from "@/lib/formbuilder/submit";
import type { Answers } from "@/lib/formbuilder/schema";

const hits = new Map<string, number[]>();
function limited(key: string, max = 6, windowMs = 10 * 60_000) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
}

/** Public submit for /f/[slug]. Validation happens again on the server; the honeypot drops bots silently. */
export async function submitPublicForm(input: { slug: string; answers: Answers; token?: string | null; hp?: string; utm?: Record<string, string>; ms?: number }): Promise<SubmitResult> {
  if (typeof input?.slug !== "string" || !/^[a-z0-9-]{2,61}$/.test(input.slug) || typeof input.answers !== "object" || !input.answers) return { ok: false, error: "Invalid form" };
  if (input.hp) return { ok: true }; // bot filled the hidden field
  if (typeof input.ms === "number" && input.ms < 1500) return { ok: true }; // too fast for a person
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 64);
  if (limited(`${input.slug}:${ip}`)) return { ok: false, error: "Too many submissions, try again in a few minutes." };
  try {
    return await handleSubmission({
      slug: input.slug,
      answers: input.answers,
      token: input.token ?? null,
      meta: {
        ip_hash: ip ? createHash("sha256").update(ip).digest("hex").slice(0, 16) : null,
        ua: (h.get("user-agent") ?? "").slice(0, 300) || null,
        referrer: (h.get("referer") ?? "").slice(0, 300) || null,
        utm: Object.fromEntries(Object.entries(input.utm ?? {}).filter(([k]) => k.startsWith("utm_")).map(([k, v]) => [k, String(v).slice(0, 100)])),
      },
    });
  } catch (e) {
    console.error("form submit", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
