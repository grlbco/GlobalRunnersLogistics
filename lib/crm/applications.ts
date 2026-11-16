import type { SupabaseClient } from "@supabase/supabase-js";

/** A submitted driver application as the CRM shows it. */
export type Answer = { label: string; value: string };
export type Application = {
  code: string;
  contactId: string;
  name: string;
  submittedAt: string;
  answers: Answer[];
  concerns: string[];
};

/** Answers that usually mean "not a fit" (or need a closer look), shown in red. */
export function isConcern(a: Answer) {
  const v = a.value.trim().toLowerCase();
  switch (a.label) {
    case "Valid CDL-A":
    case "21 or older":
    case "Authorized to work in the U.S.":
      return v === "no";
    case "Ever had a DUI":
    case "Failed/refused drug test or SAP":
      return v === "yes";
    case "CDL-A experience":
      return v.startsWith("<");
    case "Moving violations (3 yrs)":
      return v === "4+";
    case "Accidents (3 yrs)":
      return v === "2+";
    default:
      return false;
  }
}

const yn = (b: boolean | null | undefined) => (b === true ? "Yes" : b === false ? "No" : "—");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const EXP: Record<string, string> = { lt1: "< 1 yr", "1-2": "1–2 yrs", "3-5": "3–5 yrs", "5plus": "5+ yrs" };

type DriverLead = {
  first_name: string; last_name: string; phone: string; email: string | null; zip: string | null; locale: string;
  driver_type: string; run_types: string[] | null; has_team_partner: boolean | null; has_cdl_a: boolean | null; experience: string;
  endorsements: string[] | null; moving_violations: string; accidents: string; dui: boolean | null; drug_test_issue: boolean | null;
  work_authorized: boolean | null; over_21: boolean | null; sms_consent: boolean | null;
};

/** Applications sent before answers were stored on the link: rebuild them from the website lead row. */
export function answersFromLead(d: DriverLead): Answer[] {
  return [
    { label: "Name", value: `${d.first_name} ${d.last_name}` },
    { label: "Mobile phone", value: d.phone },
    { label: "Email", value: d.email || "—" },
    { label: "ZIP", value: d.zip || "—" },
    { label: "How they want to drive", value: cap(d.driver_type) },
    { label: "Runs", value: d.run_types?.length ? d.run_types.map((r) => (r === "otr" ? "OTR" : cap(r))).join(", ") : "—" },
    ...(d.driver_type !== "solo" ? [{ label: "Has a team partner", value: yn(d.has_team_partner) }] : []),
    { label: "Valid CDL-A", value: yn(d.has_cdl_a) },
    { label: "CDL-A experience", value: EXP[d.experience] ?? d.experience },
    { label: "Endorsements", value: (d.endorsements ?? []).filter((e) => e !== "none").map((e) => (e === "twic" ? "TWIC" : cap(e))).join(", ") || "None" },
    { label: "Moving violations (3 yrs)", value: d.moving_violations === "4plus" ? "4+" : d.moving_violations },
    { label: "Accidents (3 yrs)", value: d.accidents === "2plus" ? "2+" : d.accidents },
    { label: "Ever had a DUI", value: yn(d.dui) },
    { label: "Failed/refused drug test or SAP", value: yn(d.drug_test_issue) },
    { label: "21 or older", value: yn(d.over_21) },
    { label: "Authorized to work in the U.S.", value: yn(d.work_authorized) },
    { label: "OK to text", value: yn(d.sms_consent) },
    { label: "Language", value: d.locale === "es" ? "Spanish" : "English" },
  ];
}

type LinkRow = {
  code: string; contact_id: string; completed_at: string; answers: Answer[] | null;
  contact: { first_name: string | null; last_name: string | null; driver_lead_id: string | null } | null;
};

async function hydrate(supabase: SupabaseClient, rows: LinkRow[]): Promise<Application[]> {
  const missing = rows.filter((r) => !r.answers?.length && r.contact?.driver_lead_id).map((r) => r.contact!.driver_lead_id!);
  const leads = new Map<string, DriverLead>();
  if (missing.length) {
    const { data } = await supabase.from("driver_leads").select("*").in("id", missing);
    for (const l of data ?? []) leads.set(l.id, l as DriverLead);
  }
  return rows.map((r) => {
    const lead = r.contact?.driver_lead_id ? leads.get(r.contact.driver_lead_id) : undefined;
    const answers = r.answers?.length ? r.answers : lead ? answersFromLead(lead) : [];
    return {
      code: r.code,
      contactId: r.contact_id,
      name: [r.contact?.first_name, r.contact?.last_name].filter(Boolean).join(" ") || "Driver",
      submittedAt: r.completed_at,
      answers,
      concerns: answers.filter(isConcern).map((a) => a.label),
    };
  });
}

const SELECT = "code, contact_id, completed_at, answers, contact:contacts(first_name, last_name, driver_lead_id)";

export async function getApplication(supabase: SupabaseClient, code: string) {
  const { data } = await supabase.from("form_links").select(SELECT).eq("code", code).not("completed_at", "is", null).maybeSingle();
  return data ? (await hydrate(supabase, [data as unknown as LinkRow]))[0] : null;
}

export async function latestApplicationFor(supabase: SupabaseClient, contactId: string) {
  const { data } = await supabase.from("form_links").select(SELECT).eq("contact_id", contactId).not("completed_at", "is", null).order("completed_at", { ascending: false }).limit(1).maybeSingle();
  return data ? (await hydrate(supabase, [data as unknown as LinkRow]))[0] : null;
}

export async function recentApplications(supabase: SupabaseClient, limit = 50) {
  const { data } = await supabase.from("form_links").select(SELECT).not("completed_at", "is", null).order("completed_at", { ascending: false }).limit(limit);
  return hydrate(supabase, (data ?? []) as unknown as LinkRow[]);
}
