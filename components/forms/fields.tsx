"use client";

import { clsx } from "clsx";
import { useEffect, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";

export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2.5 flex items-baseline justify-between gap-4 text-[0.95rem] font-medium">
      <span>{children}</span>
      {hint && <span className="label text-white/40">{hint}</span>}
    </label>
  );
}

export function ErrorText({ children, id }: { children?: string; id?: string }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-2 text-sm text-[#ff8a6b]">
      {children}
    </p>
  );
}

const inputBase =
  "block w-full rounded-[4px] border bg-white/[0.04] px-4 text-[1.05rem] text-white placeholder:text-white/30 outline-none transition-colors focus:border-signal focus:bg-white/[0.07]";

export function TextField({
  label,
  name,
  error,
  hint,
  className,
  ...rest
}: { label: string; name: string; error?: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      <Label htmlFor={name} hint={hint}>
        {label}
      </Label>
      <input
        id={name}
        name={name}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-err` : undefined}
        className={clsx(inputBase, "h-14", error ? "border-[#ff8a6b]" : "border-white/15")}
        {...rest}
      />
      <ErrorText id={`${name}-err`}>{error}</ErrorText>
    </div>
  );
}

export function TextArea({
  label,
  name,
  error,
  className,
  ...rest
}: { label: string; name: string; error?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className={className}>
      <Label htmlFor={name}>{label}</Label>
      <textarea
        id={name}
        name={name}
        rows={5}
        aria-invalid={!!error}
        className={clsx(inputBase, "py-3.5", error ? "border-[#ff8a6b]" : "border-white/15")}
        {...rest}
      />
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

type Option<V extends string> = { value: V; label: string };

/** Big tap targets. Single-select (radio) or multi-select (checkbox) chips. */
export function Chips<V extends string>({
  legend,
  options,
  value,
  onChange,
  multiple,
  error,
  columns = 2,
}: {
  legend: string;
  options: readonly Option<V>[];
  value: V | V[] | undefined;
  onChange: (v: V | V[]) => void;
  multiple?: boolean;
  error?: string;
  columns?: 2 | 3 | 4 | 5;
}) {
  const selected = (v: V) => (multiple ? ((value as V[]) ?? []).includes(v) : value === v);
  const toggle = (v: V) => {
    if (!multiple) return onChange(v);
    const cur = (value as V[]) ?? [];
    onChange(cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
  };
  return (
    <fieldset>
      <legend className="mb-3 text-[0.95rem] font-medium">
        {legend}
        {multiple && <span className="label ml-3 text-white/40">Pick all that apply</span>}
      </legend>
      <div
        className={clsx(
          "grid gap-2",
          columns === 2 && "grid-cols-2",
          columns === 3 && "grid-cols-2 sm:grid-cols-3",
          columns === 4 && "grid-cols-2 sm:grid-cols-4",
          columns === 5 && "grid-cols-3 sm:grid-cols-5",
        )}
        role={multiple ? "group" : "radiogroup"}
      >
        {options.map((o) => {
          const on = selected(o.value);
          return (
            <button
              key={o.value}
              type="button"
              role={multiple ? "checkbox" : "radio"}
              aria-checked={on}
              onClick={() => toggle(o.value)}
              className={clsx(
                "flex min-h-14 items-center justify-center rounded-[4px] border px-3 py-3 text-center text-[0.98rem] transition-all duration-200",
                on ? "border-signal bg-signal/15 text-white" : "border-white/15 bg-white/[0.03] text-white/80 hover:border-white/40",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <ErrorText>{error}</ErrorText>
    </fieldset>
  );
}

export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-white/65">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className={clsx(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] border transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-signal",
          checked ? "border-signal bg-signal" : "border-white/30",
        )}
      >
        {checked && (
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
            <path d="M2 6.5l2.5 2.5L10 3.5" stroke="white" strokeWidth="1.8" />
          </svg>
        )}
      </span>
      <span>{children}</span>
    </label>
  );
}

/** Hidden honeypot field bots tend to fill. */
export function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>
        Company website
        <input tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}

type Attribution = { utm: Record<string, string>; referrer?: string; landing_page?: string };

/** First-touch attribution (UTM + referrer + landing page), stored for the session. */
export function readAttribution(): Attribution {
  try {
    const stored = sessionStorage.getItem("grl_attr");
    if (stored) return JSON.parse(stored) as Attribution;
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"].forEach((k) => {
      const v = params.get(k);
      if (v) utm[k] = v.slice(0, 200);
    });
    const value: Attribution = { utm, referrer: document.referrer.slice(0, 500) || undefined, landing_page: window.location.pathname.slice(0, 500) };
    sessionStorage.setItem("grl_attr", JSON.stringify(value));
    return value;
  } catch {
    return { utm: {} };
  }
}

/** Forms call the returned getter at submit time. */
export function useAttribution() {
  return readAttribution;
}

/** Mount once in the root layout so first-touch attribution is captured on any landing page. */
export function AttributionCapture() {
  useEffect(() => {
    readAttribution();
  }, []);
  return null;
}
