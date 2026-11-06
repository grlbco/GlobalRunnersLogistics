export const fullName = (c: { first_name?: string | null; last_name?: string | null; company_name?: string | null }) =>
  [c.first_name, c.last_name].filter(Boolean).join(" ") || c.company_name || "Unknown";

export const initials = (c: { first_name?: string | null; last_name?: string | null }) =>
  ((c.first_name?.[0] ?? "") + (c.last_name?.[0] ?? "")).toUpperCase() || "·";

export function phoneDisplay(e164?: string | null) {
  if (!e164) return null;
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

export function ago(iso?: string | null, now = Date.now()) {
  if (!iso) return "—";
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const n = (v: number | null | undefined) => (v ?? 0).toLocaleString("en-US");

/** Reviewed drafts, from the activity log, in the shape the auto-send rules read. */
export function reviewsFrom(rows: { type: string; data: unknown }[]) {
  return rows.map((r) => {
    const d = (r.data ?? {}) as { group?: string | null; edited?: boolean };
    return { group: d.group, edited: d.edited, discarded: r.type === "draft_discarded" };
  });
}
