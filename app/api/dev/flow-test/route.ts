import { adminDb } from "@/lib/crm/admin";
import { processAgentQueue, scheduleNext } from "@/lib/agent/engine";
import { completeForm } from "@/lib/crm/forms";
import { processDue } from "@/lib/crm/outbox";

export const maxDuration = 300;

/**
 * Local-only live test of the reply → form → follow-up → submitted flow on the contact tagged "test".
 * Real model calls and real sends (to the test contact only). Leaves the contact ready for more testing.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const db = adminDb();
  const { data: c0 } = await db.from("contacts").select("*").contains("tags", ["test"]).limit(1).single();
  if (!c0) return Response.json({ error: "no test contact" }, { status: 400 });
  const id = c0.id as string;
  const steps: { step: string; ok: boolean; detail?: unknown }[] = [];
  const check = (step: string, ok: boolean, detail?: unknown) => steps.push({ step, ok, detail });
  const contact = async () => (await db.from("contacts").select("*").eq("id", id).single()).data!;
  const pendingFollowups = async () => (await db.from("followups").select("attempt, kind, channel, due_at, reason").eq("contact_id", id).eq("status", "pending").order("due_at")).data ?? [];

  // 0) clean start: link "sent" 3h ago, nothing pending
  await db.from("followups").update({ status: "cancelled" }).eq("contact_id", id).eq("status", "pending");
  await db.from("outbox").update({ status: "cancelled", error: "flow test reset" }).eq("contact_id", id).in("status", ["draft", "pending"]);
  await db.from("contacts").update({ stage: "form_sent", agent_mode: "auto", agent_paused_until: null, do_not_contact: false }).eq("id", id);
  const { data: link } = await db.from("form_links").insert({ contact_id: id, sent_at: new Date(Date.now() - 3 * 3600_000).toISOString() }).select("token").single();
  check("reset: stage Form sent, fresh form link", !!link);

  // 1) the chase gets planned once the link is out
  const c1 = await contact();
  await scheduleNext(c1, { linkOut: true, kind: null, attempt: 0, maxNudges: 5 });
  const f1 = await pendingFollowups();
  check("chase planned: follow-up #1 in ~2h", f1.length > 0 && f1[0].kind === "chase" && f1[0].attempt === 1, f1);

  // 2) 2h pass: follow-up #1 runs for real
  await db.from("followups").update({ due_at: new Date(Date.now() - 1000).toISOString() }).eq("contact_id", id).eq("status", "pending");
  const run = await processAgentQueue(5);
  const c2 = await contact();
  const { data: out2 } = await db.from("outbox").select("channel, body, status, send_after, error").eq("contact_id", id).eq("author", "agent").in("status", ["pending", "draft", "sent"]).order("created_at", { ascending: false }).limit(4);
  check("follow-up #1 ran", run.some((r) => r.action.startsWith("followup:")), run);
  check("card moved to Following up", c2.stage === "chasing", c2.stage);
  check("follow-up message queued", (out2 ?? []).length > 0, out2);
  const f2 = await pendingFollowups();
  check("next follow-up (#2) planned", f2.some((f) => f.attempt === 2 && f.kind === "chase"), f2);

  // 3) the driver fills the form
  await completeForm({ token: link!.token, first_name: c0.first_name ?? "George", last_name: c0.last_name ?? "Test", phone: c0.cell_phone ?? c0.phone, email: c0.email, sms_consent: true, summary: "Flow test submission", flags: [] });
  const c3 = await contact();
  const f3 = await pendingFollowups();
  const { data: agentPending } = await db.from("outbox").select("id").eq("contact_id", id).eq("author", "agent").in("status", ["pending", "draft"]);
  const { data: confirm } = await db.from("outbox").select("id, body, status").eq("contact_id", id).eq("author", "workflow").eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle();
  check("card moved to Applied", c3.stage === "applied", c3.stage);
  check("all follow-ups stopped", f3.length === 0, f3);
  check("unsent assistant messages cancelled", (agentPending ?? []).length === 0);
  check("confirmation text queued", !!confirm, confirm?.body);

  // 4) send the confirmation now
  if (confirm) await db.from("outbox").update({ send_after: new Date().toISOString() }).eq("id", confirm.id);
  const sent = await processDue(10);
  const conf = sent.find((s) => s.id === confirm?.id);
  check("confirmation text sent", !!conf?.ok, conf);
  const { data: mem } = await db.from("agent_memory").select("next_step").eq("contact_id", id).maybeSingle();
  check("assistant memory updated", /completed/i.test(mem?.next_step ?? ""), mem?.next_step);
  check("Telegram alert", !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_CHAT_ID, process.env.TELEGRAM_BOT_TOKEN ? "configured" : "not configured yet (add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID)");

  // 5) leave the test contact ready for more testing
  await db.from("contacts").update({ stage: "replied" }).eq("id", id);
  await db.from("form_links").insert({ contact_id: id });

  return Response.json({ passed: steps.filter((s) => s.ok).length, total: steps.length, steps }, { headers: { "Cache-Control": "no-store" } });
}
