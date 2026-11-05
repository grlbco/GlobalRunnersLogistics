import { adminDb } from "@/lib/crm/admin";
import { TEMPLATES } from "@/lib/formbuilder/schema";
import { handleSubmission } from "@/lib/formbuilder/submit";
import { processAgentQueue } from "@/lib/agent/engine";

export const maxDuration = 300;

/**
 * Local-only live test of the Forms module on the contact tagged "test": publishes a temporary
 * "Quick interest" form, submits it with the test contact's phone, checks every side effect,
 * lets the assistant answer for real, then deletes the temporary form.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  try {
    return await run();
  } catch (e) {
    return Response.json({ error: e instanceof Error ? `${e.message}\n${e.stack}` : String(e) }, { status: 500 });
  }
}

async function run() {
  const db = adminDb();
  const { data: c0 } = await db.from("contacts").select("*").contains("tags", ["test"]).limit(1).single();
  if (!c0) return Response.json({ error: "no test contact" }, { status: 400 });
  const steps: { step: string; ok: boolean; detail?: unknown }[] = [];
  const check = (step: string, ok: boolean, detail?: unknown) => steps.push({ step, ok, detail });

  await db.from("contacts").update({ stage: "replied", agent_mode: "auto", agent_paused_until: null }).eq("id", c0.id);
  await db.from("outbox").update({ status: "cancelled", error: "forms test reset" }).eq("contact_id", c0.id).in("status", ["draft", "pending"]);
  await db.from("form_links").insert({ contact_id: c0.id }); // fresh, unsent driver application link
  const t = TEMPLATES.quick_interest;
  const slug = `test-quick-${Math.random().toString(36).slice(2, 6)}`;
  const { data: form } = await db.from("crm_forms").insert({ name: "Quick interest (test)", slug, status: "published", schema: t.schema, on_submit: t.on_submit }).select("id").single();
  check("temporary form published", !!form, slug);

  const r = await handleSubmission({
    slug,
    answers: { fn: c0.first_name ?? "George", ln: c0.last_name ?? "Test", ph: c0.cell_phone, cdl: "Yes", exp: "3-5 years", ok: true },
    meta: { test: true },
  });
  check("submission accepted", r.ok, r);

  const { data: sub } = await db.from("crm_form_submissions").select("contact_id, data").eq("form_id", form!.id).maybeSingle();
  check("matched to the existing driver (by phone)", sub?.contact_id === c0.id, sub?.contact_id);
  const { data: c1 } = await db.from("contacts").select("stage, tags, sms_consent, sms_consent_source").eq("id", c0.id).single();
  check("card moved to Interested", c1?.stage === "interested", c1?.stage);
  check("tags added", !!c1?.tags?.includes("quick-interest") && c1.tags.includes(`form:${slug}`), c1?.tags);
  check("text consent recorded", !!c1?.sms_consent, c1?.sms_consent_source);
  const { data: note } = await db.from("notes").select("body").eq("contact_id", c0.id).order("created_at", { ascending: false }).limit(1).single();
  check("answers saved as a note", /Quick interest/.test(note?.body ?? ""), note?.body);
  const { data: act } = await db.from("activities").select("type").eq("contact_id", c0.id).eq("type", "form_submitted").order("created_at", { ascending: false }).limit(1).maybeSingle();
  check("timeline event", !!act);
  const { data: mem } = await db.from("agent_memory").select("facts").eq("contact_id", c0.id).maybeSingle();
  check("answers in the assistant's memory", JSON.stringify(mem?.facts ?? {}).includes("3-5 years"), mem?.facts);
  const { data: q } = await db.from("agent_runs").select("id").eq("contact_id", c0.id).eq("trigger", "form_submitted").eq("action", "queued").maybeSingle();
  check("assistant queued", !!q);

  // the assistant answers for real (text, with the driver application link)
  const runs = await processAgentQueue(5);
  const { data: out } = await db.from("outbox").select("channel, body, status, send_after").eq("contact_id", c0.id).eq("author", "agent").in("status", ["pending", "sent"]).order("created_at", { ascending: false }).limit(3);
  check("assistant replied", runs.some((x) => x.contactId === c0.id && x.action === "replied"), runs);
  check("reply includes the driver application link", (out ?? []).some((o) => o.body.includes("/apply/driver?t=")), out);
  const { data: f } = await db.from("followups").select("kind, attempt, due_at").eq("contact_id", c0.id).eq("status", "pending");
  check("application chase planned", (f ?? []).some((x) => x.kind === "chase"), f);
  check("Telegram alert", !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_CHAT_ID, process.env.TELEGRAM_BOT_TOKEN ? "configured" : "not configured yet");

  // clean up the temporary form (the driver keeps the note, timeline and the assistant's reply)
  await db.from("crm_forms").delete().eq("id", form!.id);
  await db.from("contacts").update({ tags: (c1?.tags ?? []).filter((x: string) => !x.startsWith("form:test-quick") && x !== "quick-interest") }).eq("id", c0.id);
  return Response.json({ passed: steps.filter((s) => s.ok).length, total: steps.length, steps }, { headers: { "Cache-Control": "no-store" } });
}
