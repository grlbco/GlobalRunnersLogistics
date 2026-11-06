import { connection } from "next/server";
import { adminDb } from "@/lib/crm/admin";

const MAX_AGE_S = 300;

/**
 * For an outside uptime monitor: a stopped worker can't report itself, so something else has to ask.
 * 200 when the worker ran in the last 5 minutes, 503 otherwise. Exposes nothing but its age.
 */
export async function GET() {
  await connection(); // always live: a cached answer would hide a stopped worker
  const headers = { "Cache-Control": "no-store" };
  try {
    const { data, error } = await adminDb().from("app_settings").select("value").eq("key", "worker").maybeSingle();
    if (error) throw error;
    const last = (data?.value as { last_tick?: string } | null)?.last_tick;
    const age = last ? Math.round((Date.now() - new Date(last).getTime()) / 1000) : null;
    const ok = age !== null && age < MAX_AGE_S;
    return Response.json({ ok, age_seconds: age }, { status: ok ? 200 : 503, headers });
  } catch {
    return Response.json({ ok: false, age_seconds: null }, { status: 503, headers });
  }
}
