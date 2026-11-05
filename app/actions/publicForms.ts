"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { handleSubmission, type SubmitResult } from "@/lib/formbuilder/submit";
import { allFields, type Answers } from "@/lib/formbuilder/schema";
import { getPublicForm } from "@/lib/formbuilder/public";
import { prefillForToken } from "@/lib/crm/forms";

const hits = new Map<string, number[]>();
function limited(key: string, max = 6, windowMs = 10 * 60_000) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
}

/** "Call me now" from a public page: personal token, or a phone number typed in. */
export async function callMeNow(input: { token?: string | null; phone?: string | null; name?: string | null; source?: string }): Promise<{ ok: boolean; inHours?: boolean; kenPhone?: string; error?: string }> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 64);
  if (limited(`call:${ip}`, 4)) return { ok: false, error: "Already requested. Ken will call you shortly." };
  const { requestCall } = await import("@/lib/crm/callme");
  const { normPhone } = await import("@/lib/formbuilder/schema");
  let contactId: string | null = null;
  if (input.token && /^[0-9a-f]{24}$/.test(input.token)) {
    const { adminDb } = await import("@/lib/crm/admin");
    const { data } = await adminDb().from("form_links").select("contact_id").eq("token", input.token).maybeSingle();
    contactId = data?.contact_id ?? null;
  }
  const phone = input.phone ? normPhone(input.phone) : null;
  if (!contactId && !phone) return { ok: false, error: "Enter a valid US phone number" };
  const source = ["form", "application", "call_page", "form_success"].includes(input.source ?? "") ? `call_me_now:${input.source}` : "call_me_now";
  const r = await requestCall({ contactId, phone, name: input.name?.slice(0, 80) ?? null, source });
  return r.ok ? { ok: true, inHours: r.inHours, kenPhone: r.kenPhone } : { ok: false, error: r.error };
}

/** Personal link (?t=): the driver's known details for the form's mapped questions. */
export async function getFormPrefill(slug: string, token: string): Promise<Answers> {
  if (!/^[a-z0-9-]{2,61}$/.test(slug) || !/^[0-9a-f]{24}$/.test(token)) return {};
  const [form, p] = await Promise.all([getPublicForm(slug), prefillForToken(token).catch(() => null)]);
  if (!form || !p) return {};
  const out: Answers = {};
  for (const f of allFields(form.schema)) {
    if (f.map === "first_name" && p.first_name) out[f.id] = p.first_name;
    if (f.map === "last_name" && p.last_name) out[f.id] = p.last_name;
    if (f.map === "full_name" && p.first_name) out[f.id] = [p.first_name, p.last_name].filter(Boolean).join(" ");
    if (f.map === "cell_phone" && p.phone) out[f.id] = p.phone;
    if (f.map === "email" && p.email) out[f.id] = p.email;
  }
  return out;
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
