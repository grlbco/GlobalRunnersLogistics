import "server-only";
import { adminDb } from "@/lib/crm/admin";
import { activity } from "@/lib/crm/ingest";
import { notifyTeam } from "@/lib/crm/notify";
import { company } from "@/content/facts";
import * as quo from "@/lib/integrations/quo";
import type { Condition, Step, TriggerType } from "./types";

/**
 * Event → workflow runs → steps. Waits put the run to sleep (wake_at); the worker tick resumes it.
 * Sends go through the outbox, so consent / opt-out / quiet hours always apply.
 */
const site = () => process.env.NEXT_PUBLIC_SITE_URL || company.url;

export async function emit(type: TriggerType, contactId: string | null | undefined, data: Record<string, unknown> = {}) {
  if (!contactId) return;
  try {
    const db = adminDb();
    const { data: flows } = await db.from("workflows").select("id, trigger_filter").eq("active", true).eq("trigger_type", type);
    for (const f of flows ?? []) {
      const filter = (f.trigger_filter ?? {}) as Record<string, unknown>;
      if (Object.entries(filter).some(([k, v]) => v !== undefined && v !== "" && data[k] !== v)) continue;
      // unique index stops a second live run for the same contact
      await db.from("workflow_runs").insert({ workflow_id: f.id, contact_id: contactId, context: { trigger: type, ...data } }).then(() => {}, () => {});
    }
  } catch (e) {
    console.error("automation emit", type, e);
  }
}

type C = { id: string; first_name: string | null; last_name: string | null; company_name: string | null; cell_phone: string | null; phone: string | null; stage: string; sms_consent: boolean; do_not_contact: boolean; agent_mode: string; tags: string[] };

async function formLink(contactId: string) {
  const db = adminDb();
  const { data } = await db.from("form_links").select("token, completed_at").eq("contact_id", contactId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const row = data ?? (await db.from("form_links").insert({ contact_id: contactId }).select("token, completed_at").single()).data!;
  return { url: `${site()}/apply/driver?t=${row.token}`, completed: !!row.completed_at };
}

async function render(tpl: string, c: C) {
  const phone = c.cell_phone ?? c.phone ?? "";
  let out = tpl
    .replaceAll("{{first_name}}", c.first_name ?? "there")
    .replaceAll("{{last_name}}", c.last_name ?? "")
    .replaceAll("{{company}}", c.company_name ?? "")
    .replaceAll("{{phone}}", phone)
    .replaceAll("{{ken_phone}}", company.phone.display)
    .replaceAll("{{crm_link}}", `${site()}/crm/contacts/${c.id}`);
  if (out.includes("{{form_link}}")) out = out.replaceAll("{{form_link}}", (await formLink(c.id)).url);
  return out.replace(/\s+([,.!?])/g, "$1").trim();
}

async function check(cond: Condition, c: C, startedAt: string): Promise<boolean> {
  switch (cond.field) {
    case "stage":
      return cond.op === "neq" ? c.stage !== cond.value : c.stage === cond.value;
    case "sms_consent":
      return cond.op === "is_false" ? !c.sms_consent : c.sms_consent;
    case "do_not_contact":
      return cond.op === "is_false" ? !c.do_not_contact : c.do_not_contact;
    case "agent_mode":
      return cond.op === "neq" ? c.agent_mode !== cond.value : c.agent_mode === cond.value;
    case "tag":
      return cond.op === "neq" || cond.op === "is_false" ? !c.tags.includes(cond.value ?? "") : c.tags.includes(cond.value ?? "");
    case "form_completed": {
      const done = (await formLink(c.id)).completed;
      return cond.op === "is_false" ? !done : done;
    }
    case "replied_since_start": {
      const { count } = await adminDb().from("messages").select("*", { count: "exact", head: true }).eq("contact_id", c.id).eq("direction", "inbound").gt("created_at", startedAt);
      const replied = (count ?? 0) > 0;
      return cond.op === "is_false" ? !replied : replied;
    }
  }
}

/** Executes one step. Returns "next", "sleep:<iso>" or "stop". */
async function runStep(step: Step, c: C, run: { id: string; created_at: string }): Promise<string> {
  const db = adminDb();
  switch (step.type) {
    case "wait": {
      const ms = ((step.minutes ?? 0) + (step.hours ?? 0) * 60 + (step.days ?? 0) * 1440) * 60_000;
      return `sleep:${new Date(Date.now() + Math.max(ms, 60_000)).toISOString()}`;
    }
    case "if":
      return (await check(step, c, run.created_at)) ? "next" : "stop";
    case "send_text":
    case "send_email": {
      const body = await render(step.body, c);
      await db.from("outbox").insert({ contact_id: c.id, channel: step.type === "send_text" ? "sms" : "email", author: "workflow", subject: step.type === "send_email" ? step.subject ?? null : null, body, dedupe_key: `wf:${run.id}:${step.type}:${body.length}` });
      return "next";
    }
    case "move_stage":
      if (c.stage !== step.stage) {
        await db.from("contacts").update({ stage: step.stage, stage_changed_at: new Date().toISOString() }).eq("id", c.id);
        await activity(c.id, "stage_changed", { from: c.stage, to: step.stage }, "workflow");
        c.stage = step.stage;
      }
      return "next";
    case "add_tag":
      if (!c.tags.includes(step.tag)) {
        c.tags = [...c.tags, step.tag];
        await db.from("contacts").update({ tags: c.tags }).eq("id", c.id);
        await activity(c.id, "tag_added", { tag: step.tag }, "workflow");
      }
      return "next";
    case "remove_tag":
      c.tags = c.tags.filter((t) => t !== step.tag);
      await db.from("contacts").update({ tags: c.tags }).eq("id", c.id);
      return "next";
    case "create_task":
      await db.from("tasks").insert({ contact_id: c.id, title: (await render(step.title, c)).slice(0, 300), due_at: new Date(Date.now() + (step.due_hours ?? 1) * 3600_000).toISOString(), created_by: "workflow" });
      return "next";
    case "notify": {
      const body = await render(step.body, c);
      const link = `${site()}/crm/contacts/${c.id}`;
      await notifyTeam(`Command: ${[c.first_name, c.last_name].filter(Boolean).join(" ") || "driver"}`, `${body}\n\n${link}`);
      if (step.to === "ken" && process.env.NOTIFY_SMS_TO && process.env.SENDING_ENABLED === "true") {
        await quo.sendText(process.env.NOTIFY_SMS_TO, `${body} ${link}`.slice(0, 600)).catch(() => {});
      }
      return "next";
    }
    case "hand_to_assistant":
      await db.from("contacts").update({ agent_mode: "auto" }).eq("id", c.id);
      await db.from("agent_runs").insert({ contact_id: c.id, trigger: "followup", action: "queued" });
      return "next";
    case "stop_assistant":
      await db.from("contacts").update({ agent_mode: "manual" }).eq("id", c.id);
      await db.from("followups").update({ status: "cancelled" }).eq("contact_id", c.id).eq("status", "pending");
      return "next";
  }
}

export async function processWorkflows(limit = 25) {
  const db = adminDb();
  const { data: runs } = await db
    .from("workflow_runs")
    .select("id, workflow_id, contact_id, step_index, created_at, log, workflow:workflows(steps, active)")
    .eq("status", "waiting")
    .lte("wake_at", new Date().toISOString())
    .order("wake_at")
    .limit(limit);
  let processed = 0;
  for (const r of runs ?? []) {
    const { data: claimed } = await db.from("workflow_runs").update({ status: "running" }).eq("id", r.id).eq("status", "waiting").select("id").maybeSingle();
    if (!claimed) continue;
    processed++;
    const wf = r.workflow as unknown as { steps: Step[]; active: boolean } | null;
    const log = (r.log as unknown[]) ?? [];
    if (!wf?.active) {
      await db.from("workflow_runs").update({ status: "cancelled", log: [...log, { at: new Date().toISOString(), note: "workflow turned off" }] }).eq("id", r.id);
      continue;
    }
    const { data: c } = await db.from("contacts").select("id, first_name, last_name, company_name, cell_phone, phone, stage, sms_consent, do_not_contact, agent_mode, tags").eq("id", r.contact_id).maybeSingle();
    if (!c) {
      await db.from("workflow_runs").update({ status: "cancelled" }).eq("id", r.id);
      continue;
    }
    let i = r.step_index;
    let status = "done";
    let wake: string | null = null;
    try {
      for (let guard = 0; i < wf.steps.length && guard < 30; guard++) {
        const step = wf.steps[i];
        const res = await runStep(step, c as C, { id: r.id, created_at: r.created_at });
        log.push({ at: new Date().toISOString(), step: i, type: step.type, result: res.startsWith("sleep") ? "waiting" : res });
        i++;
        if (res === "stop") { status = "stopped"; break; }
        if (res.startsWith("sleep:")) { status = "waiting"; wake = res.slice(6); break; }
      }
    } catch (e) {
      status = "failed";
      log.push({ at: new Date().toISOString(), step: i, error: e instanceof Error ? e.message : String(e) });
    }
    await db.from("workflow_runs").update({ status, step_index: i, log: log.slice(-50), ...(wake ? { wake_at: wake } : {}) }).eq("id", r.id);
  }
  return processed;
}
