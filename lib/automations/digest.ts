import "server-only";
import { adminDb } from "@/lib/crm/admin";
import { notifyTeam } from "@/lib/crm/notify";
import { company } from "@/content/facts";

/** Daily digest at 8:00 Pacific: replies, forms, who needs a call. Sent once per day. */
export async function maybeSendDigest() {
  const db = adminDb();
  const now = new Date();
  const pt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(now);
  const day = `${pt.find((p) => p.type === "year")?.value}-${pt.find((p) => p.type === "month")?.value}-${pt.find((p) => p.type === "day")?.value}`;
  const hour = Number(pt.find((p) => p.type === "hour")?.value);
  const { data: s } = await db.from("app_settings").select("value").eq("key", "digest").maybeSingle();
  const cfg = (s?.value as { enabled?: boolean; last?: string }) ?? { enabled: true };
  if (cfg.enabled === false || hour < 8 || cfg.last === day) return false;

  const since = new Date(now.getTime() - 86400_000).toISOString();
  const head = { count: "exact" as const, head: true };
  const [replies, applied, forms, tasks, handoffs] = await Promise.all([
    db.from("messages").select("*", head).eq("direction", "inbound").gte("created_at", since),
    db.from("activities").select("*", head).eq("type", "stage_changed").contains("data", { to: "applied" }).gte("created_at", since),
    db.from("activities").select("*", head).eq("type", "form_completed").gte("created_at", since),
    db.from("tasks").select("title, due_at, contact_id").is("done_at", null).order("due_at").limit(15),
    db.from("activities").select("*", head).eq("type", "handed_to_person").gte("created_at", since),
  ]);
  const site = process.env.NEXT_PUBLIC_SITE_URL || company.url;
  const lines = [
    `Last 24 hours`,
    `- Replies from drivers: ${replies.count ?? 0}`,
    `- Forms completed: ${forms.count ?? 0}`,
    `- New applications: ${applied.count ?? 0}`,
    `- Handed to a person: ${handoffs.count ?? 0}`,
    ``,
    `Open tasks:`,
    ...((tasks.data ?? []).map((t) => `- ${t.title}${t.contact_id ? ` → ${site}/crm/contacts/${t.contact_id}` : ""}`)),
    (tasks.data ?? []).length ? "" : "- none",
    `Open the CRM: ${site}/crm`,
  ];
  await notifyTeam(`Daily recruiting digest — ${day}`, lines.join("\n"));
  await db.from("app_settings").upsert({ key: "digest", value: { ...cfg, enabled: true, last: day } });
  return true;
}
