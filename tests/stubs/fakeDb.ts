/**
 * A small in-memory stand-in for the Supabase client, so the real worker code can run in tests
 * without touching the live database. Covers only the query shapes the app uses.
 */
type Row = Record<string, unknown>;
type Filter = (r: Row) => boolean;

const UNIQUE: Record<string, string[]> = { events: ["external_id"], messages: ["external_id"], outbox: ["dedupe_key"] };
const AUTO_TS = new Set(["messages", "agent_runs", "tasks", "outbox", "followups", "events", "activities", "stage_events", "consents"]);

export class FakeDb {
  tables: Record<string, Row[]> = {};
  private n = 0;
  rows(t: string) { return (this.tables[t] ??= []); }
  seed(t: string, ...rows: Row[]) { for (const r of rows) this.rows(t).push({ id: this.nextId(), ...r }); }
  nextId() { return `id-${++this.n}`; }
  from(t: string) { return new Query(this, t); }
}

const like = (v: unknown, pattern: string, ci = false) => {
  const re = new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*")}$`, ci ? "i" : "");
  return typeof v === "string" && re.test(v);
};

class Query {
  private filters: Filter[] = [];
  private op: "select" | "insert" | "update" | "upsert" = "select";
  private payload: Row[] = [];
  private patch: Row = {};
  private head = false;
  private wantCount = false;
  private returning = false;
  private sort: { col: string; asc: boolean } | null = null;
  private max: number | null = null;
  private one: "single" | "maybe" | null = null;

  constructor(private db: FakeDb, private table: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op !== "select") this.returning = true;
    if (opts?.head) this.head = true;
    if (opts?.count) this.wantCount = true;
    return this;
  }
  insert(v: Row | Row[]) { this.op = "insert"; this.payload = Array.isArray(v) ? v : [v]; return this; }
  upsert(v: Row | Row[]) { this.op = "upsert"; this.payload = Array.isArray(v) ? v : [v]; return this; }
  update(v: Row) { this.op = "update"; this.patch = v; return this; }
  eq(c: string, v: unknown) { this.filters.push((r) => r[c] === v); return this; }
  neq(c: string, v: unknown) { this.filters.push((r) => r[c] !== v); return this; }
  in(c: string, vs: unknown[]) { this.filters.push((r) => vs.includes(r[c])); return this; }
  is(c: string, v: unknown) { this.filters.push((r) => (r[c] ?? null) === v); return this; }
  not(c: string, _op: string, v: unknown) { this.filters.push((r) => (r[c] ?? null) !== v); return this; }
  lt(c: string, v: string) { this.filters.push((r) => r[c] != null && String(r[c]) < v); return this; }
  lte(c: string, v: string) { this.filters.push((r) => r[c] != null && String(r[c]) <= v); return this; }
  gt(c: string, v: string) { this.filters.push((r) => r[c] != null && String(r[c]) > v); return this; }
  gte(c: string, v: string) { this.filters.push((r) => r[c] != null && String(r[c]) >= v); return this; }
  like(c: string, p: string) { this.filters.push((r) => like(r[c], p)); return this; }
  ilike(c: string, p: string) { this.filters.push((r) => like(r[c], p, true)); return this; }
  contains(c: string, vs: unknown[]) { this.filters.push((r) => vs.every((v) => (r[c] as unknown[] | undefined)?.includes(v))); return this; }
  order(col: string, o?: { ascending?: boolean }) { this.sort ??= { col, asc: o?.ascending !== false }; return this; }
  limit(n: number) { this.max = n; return this; }
  single() { this.one = "single"; return this; }
  maybeSingle() { this.one = "maybe"; return this; }

  then<T>(ok: (v: { data: unknown; error: { code: string; message: string } | null; count: number | null }) => T) {
    return Promise.resolve(this.run()).then(ok);
  }

  private run() {
    const rows = this.db.rows(this.table);
    const match = () => rows.filter((r) => this.filters.every((f) => f(r)));
    let result: Row[] = [];
    if (this.op === "insert" || this.op === "upsert") {
      for (const p of this.payload) {
        const key = this.op === "upsert" ? ("key" in p ? "key" : "contact_id" in p ? "contact_id" : null) : null;
        const existing = key ? rows.find((r) => r[key] === p[key]) : null;
        if (existing) { Object.assign(existing, p); result.push(existing); continue; }
        for (const u of UNIQUE[this.table] ?? []) {
          if (p[u] != null && rows.some((r) => r[u] === p[u])) return { data: null, error: { code: "23505", message: "duplicate" }, count: null };
        }
        const row: Row = { id: this.db.nextId(), ...(AUTO_TS.has(this.table) ? { created_at: new Date().toISOString() } : {}), ...(this.table === "outbox" ? { attempts: 0 } : {}), ...(this.table === "followups" ? { status: "pending" } : {}), ...p };
        rows.push(row);
        result.push(row);
      }
    } else if (this.op === "update") {
      result = match();
      for (const r of result) Object.assign(r, this.patch);
    } else {
      result = match();
    }
    const count = result.length;
    if (this.sort) { const { col, asc } = this.sort; result = [...result].sort((a, b) => (String(a[col] ?? "") < String(b[col] ?? "") ? -1 : 1) * (asc ? 1 : -1)); }
    if (this.max != null) result = result.slice(0, this.max);
    const copy = result.map((r) => ({ ...r }));
    if (this.op !== "select" && !this.returning && !this.one) return { data: null, error: null, count: null };
    if (this.head) return { data: null, error: null, count };
    if (this.one) {
      if (this.one === "single" && !copy[0]) return { data: null, error: { code: "PGRST116", message: "no rows" }, count: null };
      return { data: copy[0] ?? null, error: null, count: null };
    }
    return { data: copy, error: null, count: this.wantCount ? count : null };
  }
}
