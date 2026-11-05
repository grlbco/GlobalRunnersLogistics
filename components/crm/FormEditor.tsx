"use client";

import { useMemo, useState, useTransition } from "react";
import { clsx } from "clsx";
import { saveForm } from "@/app/crm/forms/actions";
import { STAGES } from "@/lib/crm/stages";
import { CRM_MAP, FIELD_TYPES, newField, newId, type CrmMap, type FieldType, type FormField, type FormSchema, type OnSubmit } from "@/lib/formbuilder/schema";
import { PublicForm } from "@/components/forms/PublicForm";
import { Card, Label, btnCls, btnGhostCls, inputCls } from "./ui";

type F = { id: string; name: string; slug: string; status: "draft" | "published" | "closed"; schema: FormSchema; on_submit: OnSubmit };
type Sel = { page: number; field: number } | null;

const ASSIGNABLE = STAGES.filter((s) => ["new", "replied", "interested", "form_sent", "applied", "nurture"].includes(s.key));

export function FormEditor({ initial, siteUrl }: { initial: F; siteUrl: string }) {
  const [f, setF] = useState<F>(initial);
  const [sel, setSel] = useState<Sel>(null);
  const [view, setView] = useState<"build" | "preview">("build");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const [drag, setDrag] = useState<{ page: number; field: number } | null>(null);

  const upd = (patch: Partial<F>) => {
    setF((x) => ({ ...x, ...patch }));
    setDirty(true);
  };
  const updSchema = (fn: (s: FormSchema) => FormSchema) => upd({ schema: fn(structuredClone(f.schema)) });
  const field = sel ? f.schema.pages[sel.page]?.fields[sel.field] : null;
  const updField = (patch: Partial<FormField>) => sel && updSchema((s) => (Object.assign(s.pages[sel.page].fields[sel.field], patch), s));
  const link = `${siteUrl}/f/${f.slug}`;

  const save = (status?: F["status"]) =>
    start(async () => {
      const next = status ? { ...f, status } : f;
      const r = await saveForm(next);
      if (r.ok) {
        setF(next);
        setDirty(false);
      }
      setMsg({ ok: r.ok, text: r.ok ? (status === "published" ? "Published. The link is live." : "Saved") : r.error ?? "Couldn't save" });
    });

  const move = (from: { page: number; field: number }, to: { page: number; field: number }) =>
    updSchema((s) => {
      const [item] = s.pages[from.page].fields.splice(from.field, 1);
      s.pages[to.page].fields.splice(to.field, 0, item);
      return s;
    });

  const mapsUsed = useMemo(() => new Set(f.schema.pages.flatMap((p) => p.fields.map((x) => x.map).filter(Boolean))), [f.schema]);

  return (
    <div className="space-y-5">
      {/* top bar */}
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <input value={f.name} onChange={(e) => upd({ name: e.target.value })} className={clsx(inputCls, "max-w-xs font-medium")} aria-label="Form name" />
        <div className="flex items-center gap-1 font-mono text-xs text-white/45">
          /f/
          <input value={f.slug} onChange={(e) => upd({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} className={clsx(inputCls, "h-8 w-44 font-mono text-xs")} aria-label="Link name" />
        </div>
        <span className={clsx("rounded-full px-2 py-0.5 text-[0.72rem]", f.status === "published" ? "bg-emerald-400/15 text-emerald-300" : "bg-white/[0.06] text-white/55")}>{f.status}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {msg && <span className={clsx("text-xs", msg.ok ? "text-emerald-300" : "text-red-300")}>{msg.text}</span>}
          {dirty && !msg && <span className="text-xs text-white/40">Unsaved changes</span>}
          <div className="flex rounded-[4px] border border-white/12 p-0.5">
            {(["build", "preview"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={clsx("rounded-[3px] px-3 py-1.5 text-xs capitalize", view === v ? "bg-white/10 text-white" : "text-white/50")}>{v}</button>
            ))}
          </div>
          <button onClick={() => save()} disabled={pending} className={btnGhostCls}>Save</button>
          {f.status !== "published" ? (
            <button onClick={() => save("published")} disabled={pending} className={btnCls}>Publish</button>
          ) : (
            <button onClick={() => save("closed")} disabled={pending} className={btnGhostCls}>Close form</button>
          )}
        </div>
      </Card>

      {f.status === "published" && (
        <Card className="flex flex-wrap items-center gap-3 p-4 text-sm">
          <Label>Live link</Label>
          <a href={link} target="_blank" rel="noreferrer" className="font-mono text-xs text-white/80 underline underline-offset-4">{link}</a>
          <button onClick={() => navigator.clipboard.writeText(link)} className="text-xs text-white/50 hover:text-white">Copy</button>
          <span className="text-xs text-white/40">Add ?t=&lt;driver token&gt; to prefill a known driver.</span>
        </Card>
      )}

      {view === "preview" ? (
        <Card className="mx-auto max-w-2xl bg-[#0b1424] p-6 md:p-10">
          {f.schema.settings.title && <p className="text-2xl font-semibold tracking-[-0.02em]">{f.schema.settings.title}</p>}
          {f.schema.settings.description && <p className="mt-2 text-white/60">{f.schema.settings.description}</p>}
          <div className="mt-8"><PublicForm key={JSON.stringify(f.schema).length} slug={f.slug} schema={f.schema} preview /></div>
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_24rem]">
          {/* questions */}
          <div className="space-y-5">
            {f.schema.pages.map((pg, pi) => (
              <Card key={pg.id} className="p-4">
                <div className="flex items-center gap-3">
                  <Label>Page {pi + 1}</Label>
                  <input value={pg.title ?? ""} onChange={(e) => updSchema((s) => ((s.pages[pi].title = e.target.value), s))} placeholder="Page title (optional)" className={clsx(inputCls, "h-8 max-w-xs text-xs")} />
                  {f.schema.pages.length > 1 && (
                    <button onClick={() => { updSchema((s) => (s.pages.splice(pi, 1), s)); setSel(null); }} className="ml-auto text-xs text-white/40 hover:text-red-300">Remove page</button>
                  )}
                </div>
                <ul
                  className="mt-3 space-y-2"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (drag && drag.page !== pi) { move(drag, { page: pi, field: pg.fields.length }); setDrag(null); } }}
                >
                  {pg.fields.map((fl, fi) => {
                    const on = sel?.page === pi && sel.field === fi;
                    return (
                      <li
                        key={fl.id}
                        draggable
                        onDragStart={() => setDrag({ page: pi, field: fi })}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.stopPropagation(); if (drag) { move(drag, { page: pi, field: fi }); setSel(null); setDrag(null); } }}
                        onClick={() => setSel({ page: pi, field: fi })}
                        className={clsx("group flex cursor-pointer items-center gap-3 rounded-[4px] border px-3 py-2.5", on ? "border-signal/60 bg-signal/[0.06]" : "border-white/[0.08] hover:border-white/20")}
                      >
                        <span className="cursor-grab select-none text-white/25" aria-hidden>⋮⋮</span>
                        <span className="w-28 shrink-0 font-mono text-[0.65rem] uppercase tracking-wider text-white/40">{FIELD_TYPES[fl.type].label}</span>
                        <span className="min-w-0 flex-1 truncate text-sm">{fl.label}{fl.required && <span className="text-signal"> *</span>}</span>
                        {fl.map && <span className="hidden rounded bg-dusk/15 px-1.5 py-0.5 text-[0.65rem] text-dusk sm:inline">→ {CRM_MAP[fl.map]}</span>}
                        <span className="flex gap-1 opacity-0 group-hover:opacity-100">
                          <button aria-label="Move up" disabled={fi === 0} onClick={(e) => { e.stopPropagation(); move({ page: pi, field: fi }, { page: pi, field: fi - 1 }); setSel(null); }} className="px-1 text-white/50 hover:text-white disabled:opacity-20">↑</button>
                          <button aria-label="Move down" disabled={fi === pg.fields.length - 1} onClick={(e) => { e.stopPropagation(); move({ page: pi, field: fi }, { page: pi, field: fi + 1 }); setSel(null); }} className="px-1 text-white/50 hover:text-white disabled:opacity-20">↓</button>
                          <button aria-label="Duplicate" onClick={(e) => { e.stopPropagation(); updSchema((s) => (s.pages[pi].fields.splice(fi + 1, 0, { ...structuredClone(fl), id: newId(), map: undefined }), s)); }} className="px-1 text-white/50 hover:text-white">⧉</button>
                          <button aria-label="Delete" onClick={(e) => { e.stopPropagation(); updSchema((s) => (s.pages[pi].fields.splice(fi, 1), s)); setSel(null); }} className="px-1 text-white/50 hover:text-red-300">✕</button>
                        </span>
                      </li>
                    );
                  })}
                  {!pg.fields.length && <li className="rounded-[4px] border border-dashed border-white/10 px-3 py-6 text-center text-sm text-white/35">No questions on this page. Add one below.</li>}
                </ul>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(Object.keys(FIELD_TYPES) as FieldType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        const nf = newField(t);
                        if (nf.map && mapsUsed.has(nf.map)) nf.map = undefined;
                        updSchema((s) => (s.pages[pi].fields.push(nf), s));
                        setSel({ page: pi, field: pg.fields.length });
                      }}
                      className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/60 hover:border-white/30 hover:text-white"
                    >
                      + {FIELD_TYPES[t].label}
                    </button>
                  ))}
                </div>
              </Card>
            ))}
            <button onClick={() => updSchema((s) => (s.pages.push({ id: newId(), fields: [] }), s))} className={btnGhostCls}>+ Add page (multi-step)</button>
          </div>

          {/* right panel */}
          <div className="space-y-5">
            {field ? (
              <Card className="space-y-4 p-4">
                <div className="flex items-center justify-between"><Label>Question</Label><button onClick={() => setSel(null)} className="text-xs text-white/45 hover:text-white">Form settings</button></div>
                <label className="block text-xs text-white/50">{field.type === "statement" ? "Text" : "Question"}
                  <textarea value={field.label} onChange={(e) => updField({ label: e.target.value })} rows={field.type === "consent" ? 5 : 2} className={clsx(inputCls, "mt-1 h-auto py-2")} />
                </label>
                {field.type !== "consent" && (
                  <label className="block text-xs text-white/50">Help text
                    <input value={field.description ?? ""} onChange={(e) => updField({ description: e.target.value || undefined })} className={clsx(inputCls, "mt-1")} />
                  </label>
                )}
                {["text", "textarea", "email", "phone", "number"].includes(field.type) && (
                  <label className="block text-xs text-white/50">Placeholder
                    <input value={field.placeholder ?? ""} onChange={(e) => updField({ placeholder: e.target.value || undefined })} className={clsx(inputCls, "mt-1")} />
                  </label>
                )}
                {"options" in FIELD_TYPES[field.type] && (
                  <label className="block text-xs text-white/50">Options (one per line)
                    <textarea value={(field.options ?? []).join("\n")} onChange={(e) => updField({ options: e.target.value.split("\n").map((x) => x.trimStart()).filter((x, i, arr) => x || i === arr.length - 1) })} rows={5} className={clsx(inputCls, "mt-1 h-auto py-2")} />
                  </label>
                )}
                {field.type === "number" && (
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs text-white/50">Min<input type="number" value={field.validation?.min ?? ""} onChange={(e) => updField({ validation: { ...field.validation, min: e.target.value === "" ? undefined : Number(e.target.value) } })} className={clsx(inputCls, "mt-1")} /></label>
                    <label className="block text-xs text-white/50">Max<input type="number" value={field.validation?.max ?? ""} onChange={(e) => updField({ validation: { ...field.validation, max: e.target.value === "" ? undefined : Number(e.target.value) } })} className={clsx(inputCls, "mt-1")} /></label>
                  </div>
                )}
                {["text", "email", "phone"].includes(field.type) && (
                  <label className="block text-xs text-white/50">Save answer to the driver&apos;s profile
                    <select value={field.map ?? ""} onChange={(e) => updField({ map: (e.target.value || undefined) as CrmMap | undefined })} className={clsx(inputCls, "mt-1")}>
                      {(Object.keys(CRM_MAP) as CrmMap[]).filter((k) => !k || field.type === "text" || (field.type === "email" ? k === "email" : k === "cell_phone")).map((k) => <option key={k} value={k}>{CRM_MAP[k]}</option>)}
                    </select>
                    <span className="mt-1 block text-white/35">Other answers are saved on the submission, in a note and in the assistant&apos;s memory.</span>
                  </label>
                )}
                {field.type !== "statement" && (
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={field.required} onChange={(e) => updField({ required: e.target.checked })} className="accent-[#ff5a2c]" /> Required</label>
                )}
                {field.type === "consent" && <p className="text-xs text-white/40">Ticking this gives text consent (TCPA). Keep it unticked by default and optional, so it&apos;s never a condition of applying.</p>}
              </Card>
            ) : (
              <Card className="space-y-4 p-4">
                <Label>Form page</Label>
                <label className="block text-xs text-white/50">Title<input value={f.schema.settings.title ?? ""} onChange={(e) => updSchema((s) => ((s.settings.title = e.target.value), s))} className={clsx(inputCls, "mt-1")} /></label>
                <label className="block text-xs text-white/50">Description<textarea value={f.schema.settings.description ?? ""} onChange={(e) => updSchema((s) => ((s.settings.description = e.target.value), s))} rows={2} className={clsx(inputCls, "mt-1 h-auto py-2")} /></label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs text-white/50">Button<input value={f.schema.settings.submitText ?? ""} onChange={(e) => updSchema((s) => ((s.settings.submitText = e.target.value), s))} className={clsx(inputCls, "mt-1")} /></label>
                  <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={f.schema.settings.showProgress !== false} onChange={(e) => updSchema((s) => ((s.settings.showProgress = e.target.checked), s))} className="accent-[#ff5a2c]" /> Progress bar</label>
                </div>
                <label className="block text-xs text-white/50">Thank-you message<textarea value={f.schema.settings.successMessage ?? ""} onChange={(e) => updSchema((s) => ((s.settings.successMessage = e.target.value), s))} rows={2} className={clsx(inputCls, "mt-1 h-auto py-2")} /></label>
                <label className="block text-xs text-white/50">Or send them to a page (URL)<input value={f.schema.settings.redirectUrl ?? ""} onChange={(e) => updSchema((s) => ((s.settings.redirectUrl = e.target.value), s))} placeholder="https://" className={clsx(inputCls, "mt-1")} /></label>
              </Card>
            )}

            <Card className="space-y-4 p-4">
              <Label>When someone submits</Label>
              <label className="block text-xs text-white/50">Move the card to
                <select value={f.on_submit.stage ?? ""} onChange={(e) => upd({ on_submit: { ...f.on_submit, stage: e.target.value || undefined } })} className={clsx(inputCls, "mt-1")}>
                  <option value="">Don&apos;t move</option>
                  {ASSIGNABLE.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <span className="mt-1 block text-white/35">Cards only move forward, never back.</span>
              </label>
              <label className="block text-xs text-white/50">Add tags (comma separated)
                <input value={(f.on_submit.tags ?? []).join(", ")} onChange={(e) => upd({ on_submit: { ...f.on_submit, tags: e.target.value.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) } })} className={clsx(inputCls, "mt-1")} />
              </label>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={f.on_submit.assistant === "reply"} onChange={(e) => upd({ on_submit: { ...f.on_submit, assistant: e.target.checked ? "reply" : "none" } })} className="mt-1 accent-[#ff5a2c]" /> <span>The assistant writes back within minutes<span className="block text-xs text-white/40">By text if they gave consent, otherwise by email (only if there&apos;s an email thread).</span></span></label>
              {f.on_submit.assistant === "reply" && (
                <label className="ml-6 flex items-start gap-2 text-sm"><input type="checkbox" checked={!!f.on_submit.sendDriverForm} onChange={(e) => upd({ on_submit: { ...f.on_submit, sendDriverForm: e.target.checked } })} className="mt-1 accent-[#ff5a2c]" /> <span>…and sends the driver application, then follows up until it&apos;s done</span></label>
              )}
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.on_submit.telegram} onChange={(e) => upd({ on_submit: { ...f.on_submit, telegram: e.target.checked } })} className="accent-[#ff5a2c]" /> Alert Ken&apos;s Telegram group</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.on_submit.task} onChange={(e) => upd({ on_submit: { ...f.on_submit, task: e.target.checked } })} className="accent-[#ff5a2c]" /> Create a task for the team</label>
              <p className="text-xs text-white/40">Automations can also start on &quot;A form is submitted&quot; (filter by link name: {f.slug}).</p>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
