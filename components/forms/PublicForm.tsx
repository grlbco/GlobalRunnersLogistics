"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { getFormPrefill, submitPublicForm } from "@/app/actions/publicForms";
import { UI, allFields, fieldText, settingsText, tErr, validate, type Answers, type FormField, type FormLocale, type FormSchema } from "@/lib/formbuilder/schema";
import { CallMeNow } from "./CallMeNow";

/**
 * Renders a Forms-module schema. Mobile first: big tap targets, one page at a time, progress bar.
 * `preview` disables submitting (used by the builder).
 */
export function PublicForm({ slug, schema, prefill, preview = false, locale = "en" }: { slug: string; schema: FormSchema; prefill?: Answers; preview?: boolean; locale?: FormLocale }) {
  const ui = UI[locale];
  const st = settingsText(schema.settings, locale);
  const pages = schema.pages.filter((p) => p.fields.length);
  const [page, setPage] = useState(0);
  const [a, setA] = useState<Answers>(prefill ?? {});
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [fail, setFail] = useState<string | null>(null);
  const hp = useRef<HTMLInputElement>(null);
  const started = useRef(0);
  const token = useRef<string | null>(null);
  useEffect(() => {
    started.current = now();
    if (preview) return;
    // personal link: fill in what we already know, after first paint (never blocks the page)
    const t = new URLSearchParams(window.location.search).get("t");
    if (t && /^[0-9a-f]{24}$/.test(t)) {
      token.current = t;
      getFormPrefill(slug, t).then((p) => setA((x) => ({ ...p, ...Object.fromEntries(Object.entries(x).filter(([, v]) => v !== "" && v != null)) })), () => {});
    }
  }, [slug, preview]);

  if (!pages.length) return <p className="text-white/50">{ui.empty}</p>;
  const cur = pages[Math.min(page, pages.length - 1)];
  const last = page >= pages.length - 1;
  const set = (id: string, v: Answers[string]) => {
    setA((x) => ({ ...x, [id]: v }));
    if (err[id]) setErr((e) => ({ ...e, [id]: "" }));
  };

  async function next() {
    const e = validate(cur.fields, a);
    setErr(e);
    if (Object.values(e).some(Boolean)) return;
    if (!last) {
      setPage((p) => p + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (preview) {
      setDone(st.successMessage ?? ui.thanks);
      return;
    }
    setBusy(true);
    setFail(null);
    const utm = Object.fromEntries(new URLSearchParams(window.location.search).entries());
    const r = await submitPublicForm({ slug, answers: a, token: token.current, hp: hp.current?.value, utm, ms: elapsed(started.current), locale });
    setBusy(false);
    if (r.ok) {
      if (r.redirect) window.location.assign(r.redirect);
      else setDone(r.message ?? ui.thanks);
    } else if (r.errors) {
      setErr(r.errors);
      const first = pages.findIndex((p) => p.fields.some((f) => r.errors?.[f.id]));
      if (first >= 0) setPage(first);
    } else setFail(r.error ?? "Something went wrong.");
  }

  if (done)
    return (
      <div className="border border-white/15 bg-navy p-8 md:p-12">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-signal">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <p className="h3 mt-8">{done}</p>
        {!preview && (
          <div className="mt-8">
            <CallMeNow
              token={null}
              phone={String(a[allFields(schema).find((f) => f.type === "phone")?.id ?? ""] ?? "") || null}
              name={allFields(schema).filter((f) => f.map === "first_name" || f.map === "last_name" || f.map === "full_name").map((f) => String(a[f.id] ?? "")).join(" ").trim() || null}
              source="form_success"
              locale={locale}
            />
          </div>
        )}
      </div>
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void next();
      }}
      noValidate
      className="space-y-8"
    >
      {pages.length > 1 && schema.settings.showProgress !== false && (
        <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${pages.length}, minmax(0, 1fr))` }} aria-label="Progress">
          {pages.map((p, i) => (
            <li key={p.id} className="flex flex-col gap-2">
              <span className={clsx("h-[3px] w-full transition-colors duration-500", i <= page ? "bg-signal" : "bg-white/15")} />
              {p.title && <span className={clsx("label hidden sm:block", i === page ? "text-white" : "text-white/40")}>{p.title}</span>}
            </li>
          ))}
        </ol>
      )}
      {cur.title && pages.length > 1 && <p className="h3">{cur.title}</p>}
      {/* honeypot */}
      <input ref={hp} name="company_site" tabIndex={-1} autoComplete="off" className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden />
      <div className="space-y-7">
        {cur.fields.map((f) => <Field key={f.id} f={f} v={a[f.id]} error={err[f.id] ? tErr(err[f.id], locale) : undefined} onChange={(v) => set(f.id, v)} locale={locale} />)}
      </div>
      {fail && <p className="text-sm text-red-300" role="alert">{fail}</p>}
      <div className="flex gap-3">
        {page > 0 && (
          <button type="button" onClick={() => setPage((p) => p - 1)} className="h-14 rounded-[4px] border border-white/20 px-6 text-base text-white/85 transition-colors hover:border-white">
            {ui.back}
          </button>
        )}
        <button disabled={busy} className="flex h-14 flex-1 items-center justify-center rounded-[4px] bg-signal px-6 text-base font-medium text-white transition-colors hover:bg-signal-ink disabled:opacity-60 sm:flex-none sm:min-w-48">
          {busy ? ui.sending : last ? st.submitText || ui.submit : ui.next}
        </button>
      </div>
    </form>
  );
}

const now = () => Date.now();
const elapsed = (t: number) => now() - t;

const inputCls = "h-14 w-full rounded-[4px] border border-white/15 bg-white/[0.03] px-4 text-base text-white placeholder:text-white/35 focus:border-white/50 focus:outline-none";

function Field({ f, v, error, onChange, locale }: { f: FormField; v: Answers[string]; error?: string; onChange: (v: Answers[string]) => void; locale: FormLocale }) {
  const id = `f-${f.id}`;
  const t = fieldText(f, locale);
  const ui = UI[locale];
  if (f.type === "statement")
    return (
      <div>
        <p className="body-lg text-white/80">{t.label}</p>
        {t.description && <p className="mt-2 text-white/55">{t.description}</p>}
      </div>
    );
  if (f.type === "consent")
    return (
      <div>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-white/65">
          <input type="checkbox" checked={v === true} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#ff5a2c]" />
          <span>{t.label}{f.required && " *"}</span>
        </label>
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      </div>
    );
  const s = typeof v === "string" ? v : v == null ? "" : String(v);
  const choice = (opts: (readonly [string, string])[], multi = false) => (
    <div className="grid gap-2 sm:grid-cols-2">
      {opts.map(([o, shown]) => {
        const on = multi ? Array.isArray(v) && v.includes(o) : s === o;
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => (multi ? onChange(on ? (v as string[]).filter((x) => x !== o) : [...(Array.isArray(v) ? v : []), o]) : onChange(o))}
            className={clsx("min-h-14 rounded-[4px] border px-4 py-3 text-left text-base transition-colors", on ? "border-signal bg-signal/15 text-white" : "border-white/15 text-white/80 hover:border-white/40")}
          >
            {shown}
          </button>
        );
      })}
    </div>
  );
  return (
    <div>
      <label htmlFor={id} className="block text-[1.05rem] font-medium text-white">
        {t.label}
        {f.required && <span className="text-signal"> *</span>}
      </label>
      {t.description && <p className="mt-1 text-sm text-white/55">{t.description}</p>}
      <div className="mt-3">
        {f.type === "textarea" ? (
          <textarea id={id} value={s} onChange={(e) => onChange(e.target.value)} placeholder={t.placeholder} rows={4} className={clsx(inputCls, "h-auto py-3")} />
        ) : f.type === "select" ? (
          <select id={id} value={s} onChange={(e) => onChange(e.target.value)} className={inputCls}>
            <option value="">{ui.choose}</option>
            {t.options.map(([o, shown]) => <option key={o} value={o}>{shown}</option>)}
          </select>
        ) : f.type === "radio" ? (
          choice(t.options)
        ) : f.type === "checkbox" ? (
          choice(t.options, true)
        ) : f.type === "yesno" ? (
          choice([["Yes", ui.yes], ["No", ui.no]])
        ) : (
          <input
            id={id}
            value={s}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t.placeholder}
            type={f.type === "email" ? "email" : f.type === "phone" ? "tel" : f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
            inputMode={f.type === "phone" ? "tel" : f.type === "number" ? "numeric" : f.type === "email" ? "email" : undefined}
            enterKeyHint="next"
            autoCapitalize={f.type === "email" ? "none" : f.map === "first_name" || f.map === "last_name" || f.map === "full_name" ? "words" : undefined}
            spellCheck={f.type === "email" || f.type === "phone" ? false : undefined}
            autoComplete={f.map === "first_name" ? "given-name" : f.map === "last_name" ? "family-name" : f.map === "full_name" ? "name" : f.type === "email" ? "email" : f.type === "phone" ? "tel" : undefined}
            className={inputCls}
          />
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </div>
  );
}
