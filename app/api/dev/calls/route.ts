import { callsSince } from "@/lib/integrations/quo";
import { syncQuoCalls } from "@/lib/crm/calls";

/** Dev only: last 7 days of Quo calls (raw) and a sync run. */
export async function GET() {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  try {
    const raw = await callsSince(new Date(Date.now() - 7 * 86400_000).toISOString());
    const sync = await syncQuoCalls();
    return Response.json({ found: raw.length, sample: raw.slice(0, 3), sync });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
