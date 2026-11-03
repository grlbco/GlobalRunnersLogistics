import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/config";

/**
 * Local-only integration check: calls each provider with the keys from .env.local and reports
 * ok / error. Never returns key values. Returns 404 outside `next dev`.
 */
type Result = { ok: boolean; status?: number; detail: string };

async function call(url: string, headers: Record<string, string>, pick: (j: unknown) => string): Promise<Result> {
  try {
    const res = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(15000) });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {}
    if (!res.ok) return { ok: false, status: res.status, detail: text.slice(0, 200) };
    return { ok: true, status: res.status, detail: pick(json) };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

const missing = (name: string): Result => ({ ok: false, detail: `${name} is empty in .env.local` });

export async function GET() {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const env = process.env;
  const out: Record<string, Result> = {};

  out.instantly = env.INSTANTLY_API_KEY
    ? await call("https://api.instantly.ai/api/v2/accounts?limit=100", { Authorization: `Bearer ${env.INSTANTLY_API_KEY}` }, (j) => {
        const items = ((j as { items?: { email: string; status?: number; warmup_status?: number }[] })?.items ?? []);
        return `${items.length} sending account(s): ${items.map((a) => a.email).join(", ") || "none"}`;
      })
    : missing("INSTANTLY_API_KEY");

  out.quo = env.QUO_API_KEY
    ? await call("https://api.openphone.com/v1/phone-numbers", { Authorization: env.QUO_API_KEY }, (j) => {
        const nums = ((j as { data?: { number: string; name?: string }[] })?.data ?? []);
        const hasFrom = nums.some((n) => n.number === env.QUO_FROM_NUMBER);
        return `${nums.length} number(s): ${nums.map((n) => `${n.number}${n.name ? ` (${n.name})` : ""}`).join(", ")}${hasFrom ? "" : ` — QUO_FROM_NUMBER ${env.QUO_FROM_NUMBER} not found`}`;
      })
    : missing("QUO_API_KEY");

  out.deepseek = env.DEEPSEEK_API_KEY
    ? await call("https://api.deepseek.com/models", { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` }, (j) => {
        const ids = ((j as { data?: { id: string }[] })?.data ?? []).map((m) => m.id);
        const want = env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";
        return `models: ${ids.join(", ")}${ids.includes(want) ? "" : ` — DEEPSEEK_MODEL "${want}" not in list`}`;
      })
    : missing("DEEPSEEK_API_KEY");
  if (out.deepseek.ok && env.DEEPSEEK_API_KEY) {
    const bal = await call("https://api.deepseek.com/user/balance", { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` }, (j) => {
      const b = (j as { is_available?: boolean; balance_infos?: { currency: string; total_balance: string }[] }) ?? {};
      return `balance ${b.balance_infos?.map((x) => `${x.total_balance} ${x.currency}`).join(", ") ?? "?"}${b.is_available === false ? " — NOT available (top up)" : ""}`;
    });
    out.deepseek.detail += ` · ${bal.detail}`;
  }

  out.resend = env.RESEND_API_KEY
    ? await call("https://api.resend.com/domains", { Authorization: `Bearer ${env.RESEND_API_KEY}` }, (j) => {
        const d = ((j as { data?: { name: string; status: string }[] })?.data ?? []);
        return d.map((x) => `${x.name}: ${x.status}`).join(", ") || "no domains";
      })
    : missing("RESEND_API_KEY");

  if (env.SUPABASE_SECRET_KEY) {
    try {
      const db = createClient(SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
      const { count, error } = await db.from("driver_leads").select("*", { count: "exact", head: true });
      out.supabase = error ? { ok: false, detail: error.message } : { ok: true, detail: `secret key works · driver_leads rows: ${count}` };
    } catch (e) {
      out.supabase = { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
  } else out.supabase = missing("SUPABASE_SECRET_KEY");

  const allOk = Object.values(out).every((r) => r.ok);
  return Response.json({ allOk, checkedAt: new Date().toISOString(), results: out }, { headers: { "Cache-Control": "no-store" } });
}
