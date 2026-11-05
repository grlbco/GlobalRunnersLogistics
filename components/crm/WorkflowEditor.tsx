"use client";

import { useState, useTransition } from "react";
import { clsx } from "clsx";
import { saveWorkflow } from "@/app/crm/automations/actions";
import { CONDITION_FIELDS, STEP_LABELS, TEMPLATE_VARS, TRIGGERS, type Step, type TriggerType } from "@/lib/automations/types";
import { STAGES } from "@/lib/crm/stages";
import { Card, Label, btnCls, inputCls } from "./ui";

type WF = { id: string; name: string; description: string | null; trigger_type: string; trigger_filter: Record<string, string>; steps: Step[]; active: boolean };

const DEFAULTS: Record<Step["type"], Step> = {
  wait: { type: "wait", hours: 1 },
  if: { type: "if", field: "stage", op: "eq", value: "applied" },
  send_text: { type: "send_text", body: "Hey {{first_name}}, " },
  send_email: { type: "send_email", body: "Hi {{first_name}},\n\n" },
  move_stage: { type: "move_stage", stage: "interested" },
  add_tag: { type: "add_tag", tag: "" },
  remove_tag: { type: "remove_tag", tag: "" },
  create_task: { type: "create_task", title: "Call {{first_name}}", due_hours: 1 },
  notify: { type: "notify", to: "ken", body: "{{first_name}} {{last_name}} needs attention." },
  hand_to_assistant: { type: "hand_to_assistant" },
  stop_assistant: { type: "stop_assistant" },
};

export function WorkflowEditor({ initial, canEdit }: { initial: WF; canEdit: boolean }) {
  const [wf, setWf] = useState<WF>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const upd = (patch: Partial<WF>) => (setWf((w) => ({ ...w, ...patch })), setMsg(null));
  const setStep = (i: number, s: Step) => upd({ steps: wf.steps.map((x, j) => (j === i ? s : x)) });
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= wf.steps.length) return;
    const steps = [...wf.steps];
    [steps[i], steps[j]] = [steps[j], steps[i]];
    upd({ steps });
  };
  const filterKey = TRIGGERS[wf.trigger_type as TriggerType]?.filter;

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <input value={wf.name} onChange={(e) => upd({ name: e.target.value })} disabled={!canEdit} className={clsx(inputCls, "max-w-md text-base font-medium")} />
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={wf.active} onChange={(e) => upd({ active: e.target.checked })} disabled={!canEdit} className="h-4 w-4 accent-[#e8401c]" /> Active
          </label>
        </div>
        <textarea value={wf.description ?? ""} onChange={(e) => upd({ description: e.target.value })} disabled={!canEdit} rows={2} placeholder="What this automation is for" className={clsx(inputCls, "h-auto py-2")} />
      </Card>

      <Card className="p-5">
        <Label>When</Label>
        <div className="mt-3 flex flex-wrap gap-3">
          <select value={wf.trigger_type} onChange={(e) => upd({ trigger_type: e.target.value, trigger_filter: {} })} disabled={!canEdit} className={clsx(inputCls, "max-w-xs")}>
            {Object.entries(TRIGGERS).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
          </select>
          {filterKey === "to" && (
            <select value={wf.trigger_filter.to ?? ""} onChange={(e) => upd({ trigger_filter: { to: e.target.value } })} disabled={!canEdit} className={clsx(inputCls, "max-w-xs")}>
              <option value="">to any stage</option>
              {STAGES.map((s) => <option key={s.key} value={s.key}>to {s.label}</option>)}
            </select>
          )}
          {filterKey === "source" && (
            <select value={wf.trigger_filter.source ?? ""} onChange={(e) => upd({ trigger_filter: { source: e.target.value } })} disabled={!canEdit} className={clsx(inputCls, "max-w-xs")}>
              <option value="">from anywhere</option>
              <option value="inbound_text">who texted in</option>
              <option value="inbound_email">who emailed in</option>
              <option value="website_form">from the website form</option>
            </select>
          )}
          {filterKey === "form" && <input value={wf.trigger_filter.form ?? ""} onChange={(e) => upd({ trigger_filter: { form: e.target.value.toLowerCase() } })} placeholder="form link name (blank = any form)" disabled={!canEdit} className={clsx(inputCls, "max-w-xs")} />}
          {filterKey === "tag" && <input value={wf.trigger_filter.tag ?? ""} onChange={(e) => upd({ trigger_filter: { tag: e.target.value } })} placeholder="tag name" disabled={!canEdit} className={clsx(inputCls, "max-w-xs")} />}
        </div>
      </Card>

      <ol className="space-y-3">
        {wf.steps.map((s, i) => (
          <li key={i}>
            <Card className="p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium"><span className="mr-2 font-mono text-xs text-faint">{i + 1}</span>{STEP_LABELS[s.type]}</p>
                {canEdit && (
                  <div className="flex gap-1 text-faint">
                    <button type="button" onClick={() => move(i, -1)} className="px-2 hover:text-fg" aria-label="Move up">↑</button>
                    <button type="button" onClick={() => move(i, 1)} className="px-2 hover:text-fg" aria-label="Move down">↓</button>
                    <button type="button" onClick={() => upd({ steps: wf.steps.filter((_, j) => j !== i) })} className="px-2 hover:text-red-600" aria-label="Remove">✕</button>
                  </div>
                )}
              </div>
              <div className="mt-3"><StepFields step={s} onChange={(n) => setStep(i, n)} disabled={!canEdit} /></div>
            </Card>
          </li>
        ))}
      </ol>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <select value="" onChange={(e) => e.target.value && upd({ steps: [...wf.steps, DEFAULTS[e.target.value as Step["type"]]] })} className={clsx(inputCls, "max-w-xs")}>
            <option value="">+ Add a step…</option>
            {Object.entries(STEP_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <button type="button" className={btnCls} disabled={busy} onClick={() => start(async () => { const r = await saveWorkflow(wf); setMsg({ ok: r.ok, text: r.ok ? "Saved" : r.error ?? "Error" }); })}>
            {busy ? "Saving…" : "Save automation"}
          </button>
          {msg && <span className={clsx("text-sm", msg.ok ? "text-emerald-700" : "text-red-600")}>{msg.text}</span>}
        </div>
      )}
      <p className="text-xs text-faint">Variables: {TEMPLATE_VARS.join(" ")} · Texts only go to drivers with text consent; opt-outs and quiet hours always apply.</p>
    </div>
  );
}

function StepFields({ step, onChange, disabled }: { step: Step; onChange: (s: Step) => void; disabled: boolean }) {
  const set = (patch: Record<string, unknown>) => onChange({ ...step, ...patch } as Step);
  const num = (v: string) => (v === "" ? undefined : Math.max(0, Number(v)));
  switch (step.type) {
    case "wait":
      return (
        <div className="flex flex-wrap gap-2 text-sm">
          {(["days", "hours", "minutes"] as const).map((u) => (
            <label key={u} className="flex items-center gap-2"><input type="number" min={0} value={step[u] ?? ""} onChange={(e) => set({ [u]: num(e.target.value) })} disabled={disabled} className={clsx(inputCls, "w-20")} />{u}</label>
          ))}
        </div>
      );
    case "if":
      return (
        <div className="flex flex-wrap gap-2">
          <select value={step.field} onChange={(e) => set({ field: e.target.value, op: ["stage", "agent_mode", "tag"].includes(e.target.value) ? "eq" : "is_true", value: e.target.value === "stage" ? "applied" : e.target.value === "agent_mode" ? "auto" : "" })} disabled={disabled} className={clsx(inputCls, "max-w-xs")}>
            {Object.entries(CONDITION_FIELDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          {["stage", "agent_mode", "tag"].includes(step.field) ? (
            <>
              <select value={step.op} onChange={(e) => set({ op: e.target.value })} disabled={disabled} className={clsx(inputCls, "w-28")}>
                <option value="eq">is</option>
                <option value="neq">is not</option>
              </select>
              {step.field === "stage" ? (
                <select value={step.value ?? ""} onChange={(e) => set({ value: e.target.value })} disabled={disabled} className={clsx(inputCls, "max-w-xs")}>{STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
              ) : step.field === "agent_mode" ? (
                <select value={step.value ?? "auto"} onChange={(e) => set({ value: e.target.value })} disabled={disabled} className={clsx(inputCls, "w-32")}><option value="auto">Auto</option><option value="manual">Manual</option></select>
              ) : (
                <input value={step.value ?? ""} onChange={(e) => set({ value: e.target.value })} placeholder="tag" disabled={disabled} className={clsx(inputCls, "max-w-xs")} />
              )}
            </>
          ) : (
            <select value={step.op} onChange={(e) => set({ op: e.target.value })} disabled={disabled} className={clsx(inputCls, "w-28")}>
              <option value="is_true">yes</option>
              <option value="is_false">no</option>
            </select>
          )}
          <span className="self-center text-xs text-faint">otherwise stop</span>
        </div>
      );
    case "send_text":
      return <textarea value={step.body} onChange={(e) => set({ body: e.target.value })} maxLength={320} rows={2} disabled={disabled} className={clsx(inputCls, "h-auto py-2")} />;
    case "send_email":
      return (
        <div className="space-y-2">
          <input value={step.subject ?? ""} onChange={(e) => set({ subject: e.target.value })} placeholder="Subject (optional — replies stay in the thread)" disabled={disabled} className={inputCls} />
          <textarea value={step.body} onChange={(e) => set({ body: e.target.value })} rows={4} disabled={disabled} className={clsx(inputCls, "h-auto py-2")} />
        </div>
      );
    case "move_stage":
      return <select value={step.stage} onChange={(e) => set({ stage: e.target.value })} disabled={disabled} className={clsx(inputCls, "max-w-xs")}>{STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>;
    case "add_tag":
    case "remove_tag":
      return <input value={step.tag} onChange={(e) => set({ tag: e.target.value.toLowerCase().replace(/\s+/g, "-") })} placeholder="tag" disabled={disabled} className={clsx(inputCls, "max-w-xs")} />;
    case "create_task":
      return (
        <div className="flex flex-wrap gap-2">
          <input value={step.title} onChange={(e) => set({ title: e.target.value })} disabled={disabled} className={clsx(inputCls, "max-w-md")} />
          <label className="flex items-center gap-2 text-sm">due in <input type="number" min={0} value={step.due_hours ?? 1} onChange={(e) => set({ due_hours: num(e.target.value) })} disabled={disabled} className={clsx(inputCls, "w-20")} /> h</label>
        </div>
      );
    case "notify":
      return (
        <div className="space-y-2">
          <select value={step.to} onChange={(e) => set({ to: e.target.value })} disabled={disabled} className={clsx(inputCls, "w-48")}>
            <option value="ken">Ken (text + email)</option>
            <option value="team">Team (email)</option>
          </select>
          <textarea value={step.body} onChange={(e) => set({ body: e.target.value })} rows={2} disabled={disabled} className={clsx(inputCls, "h-auto py-2")} />
        </div>
      );
    default:
      return <p className="text-xs text-faint">No settings.</p>;
  }
}
