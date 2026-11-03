import { readFile } from "node:fs/promises";
import path from "node:path";
import { adminDb } from "@/lib/crm/admin";
import { parseCsv } from "@/lib/crm/csv";
import { stateTimezone } from "@/lib/crm/timezones";

/**
 * Local-only: imports the TOSS 20k driver-lead CSV (data/leads-20k.csv, git-ignored) into contacts.
 * Idempotent: upserts on USDOT. Returns 404 outside `next dev`.
 */
const E164 = /^\+[1-9]\d{7,14}$/;
const clean = (v?: string) => (v ?? "").trim() || null;

export async function GET() {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const file = path.join(process.cwd(), "data", "leads-20k.csv");
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch {
    return Response.json({ ok: false, error: `CSV not found at ${file}` }, { status: 400 });
  }
  const [header, ...rows] = parseCsv(text);
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
  const idx = {
    usdot: col("USDOT"), company: col("Company Name"), street: col("Street"), city: col("City"), state: col("State"),
    first: col("First Name"), last: col("Last Name"), email: col("Email"), officer2: col("Officer 2"),
    phone: col("Phone"), cell: col("Cell Phone"), tier: col("Tier"),
  };
  const missing = Object.entries(idx).filter(([, i]) => i < 0).map(([k]) => k);
  if (missing.length) return Response.json({ ok: false, error: `Missing columns: ${missing.join(", ")}`, header }, { status: 400 });

  const seenEmail = new Set<string>();
  const seenDot = new Set<number>();
  const skipped: Record<string, number> = { duplicate_email: 0, duplicate_usdot: 0, bad_usdot: 0 };
  const records = [];
  for (const r of rows) {
    const usdot = Number(clean(r[idx.usdot]));
    if (!Number.isFinite(usdot) || usdot <= 0) { skipped.bad_usdot++; continue; }
    if (seenDot.has(usdot)) { skipped.duplicate_usdot++; continue; }
    const email = clean(r[idx.email])?.toLowerCase() ?? null;
    if (email && seenEmail.has(email)) { skipped.duplicate_email++; continue; }
    seenDot.add(usdot);
    if (email) seenEmail.add(email);
    const state = clean(r[idx.state])?.toUpperCase().slice(0, 2) ?? null;
    const tierLabel = clean(r[idx.tier]);
    const tier = Number(tierLabel?.match(/^(\d)/)?.[1]) || null;
    const phone = clean(r[idx.phone]);
    const cell = clean(r[idx.cell]);
    records.push({
      usdot,
      company_name: clean(r[idx.company]),
      street: clean(r[idx.street]),
      city: clean(r[idx.city]),
      state: state && state.length === 2 ? state : null,
      timezone: stateTimezone(state),
      first_name: clean(r[idx.first]),
      last_name: clean(r[idx.last]),
      email,
      officer_2: clean(r[idx.officer2]),
      phone: phone && E164.test(phone) ? phone : null,
      cell_phone: cell && E164.test(cell) ? cell : null,
      tier: tier && tier >= 1 && tier <= 5 ? tier : null,
      tier_label: tierLabel,
      source: "toss_import",
    });
  }

  const db = adminDb();
  let imported = 0;
  const errors: string[] = [];
  for (let i = 0; i < records.length; i += 1000) {
    const batch = records.slice(i, i + 1000);
    const { error } = await db.from("contacts").upsert(batch, { onConflict: "usdot", ignoreDuplicates: false });
    if (error) errors.push(`rows ${i}-${i + batch.length}: ${error.message}`);
    else imported += batch.length;
  }
  const { count } = await db.from("contacts").select("*", { count: "exact", head: true });
  return Response.json({ ok: errors.length === 0, csvRows: rows.length, imported, skipped, errors, contactsInDb: count });
}
