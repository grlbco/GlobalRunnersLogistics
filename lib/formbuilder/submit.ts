import "server-only";
import { adminDb } from "@/lib/crm/admin";
import { activity, contactByEmail, contactByPhone, moveStage, type Contact } from "@/lib/crm/ingest";
import { stateTimezone } from "@/lib/crm/timezones";
import { STAGE_KEYS, type Stage } from "@/lib/crm/stages";
import { siteUrl } from "@/lib/site";
import { allFields, normPhone, settingsText, validate, type Answers, type FormField, type FormSchema, type OnSubmit } from "./schema";

const STATES: Record<string, string> = { alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY" };
const stateCode = (v: string) => {
  const t = v.trim();
  if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase();
  return STATES[t.toLowerCase()] ?? null;
};

const show = (f: FormField, v: Answers[string]) =>
  f.type === "consent" ? (v === true ? "Yes" : "No") : Array.isArray(v) ? v.join(", ") : v == null || v === "" ? "—" : String(v);

export type SubmitResult = { ok: true; message?: string; redirect?: string } | { ok: false; errors?: Record<string, string>; error?: string };

/**
 * One public submission → CRM. Order matters: validate, find/create the contact, save answers,
 * then the side effects (stage, tags, consent, note, automations, assistant, Telegram).
 */
export async function handleSubmission(input: { slug: string; answers: Answers; token?: string | null; meta: Record<string, unknown>; locale?: "en" | "es" }): Promise<SubmitResult> {
  const db = adminDb();
  const { data: form } = await db.from("crm_forms").select("id, name, slug, status, schema, on_submit").eq("slug", input.slug).maybeSingle();
  if (!form || form.status !== "published") return { ok: false, error: "This form isn't taking answers right now." };
  const schema = form.schema as FormSchema;
  const rules = (form.on_submit ?? {}) as OnSubmit;
  const fields = allFields(schema);

  // keep only known fields, then validate everything server-side
  const answers: Answers = {};
  for (const f of fields) if (f.type !== "statement" && f.id in input.answers) answers[f.id] = input.answers[f.id];
  const errors = validate(fields, answers);
  if (Object.keys(errors).length) return { ok: false, errors };

  // what maps onto the profile
  const profile: Record<string, string> = {};
  for (const f of fields) {
    const v = answers[f.id];
    if (!f.map || v == null || v === "" || Array.isArray(v)) continue;
    const s = String(v).trim();
    if (f.map === "full_name") {
      const [first, ...rest] = s.split(/\s+/);
      profile.first_name ??= first;
      if (rest.length) profile.last_name ??= rest.join(" ");
    } else if (f.map === "cell_phone") {
      const p = normPhone(s);
      if (p) profile.cell_phone = p;
    } else if (f.map === "email") profile.email = s.toLowerCase();
    else if (f.map === "state") {
      const st = stateCode(s);
      if (st) profile.state = st;
    } else profile[f.map] = s;
  }
  const consent = fields.some((f) => f.type === "consent" && answers[f.id] === true);

  // contact: personal link first, then email/phone, else a new one
  let contact: Contact | null = null;
  if (input.token && /^[0-9a-f]{24}$/.test(input.token)) {
    const { data: link } = await db.from("form_links").select("contact_id").eq("token", input.token).maybeSingle();
    if (link) contact = (await db.from("contacts").select("id, stage, email, phone, cell_phone, do_not_contact, sms_consent, agent_mode, first_name").eq("id", link.contact_id).single()).data as Contact;
  }
  contact ??= (profile.email ? await contactByEmail(profile.email) : null) ?? (profile.cell_phone ? await contactByPhone(profile.cell_phone) : null);
  let created = false;
  if (!contact) {
    if (!profile.cell_phone && !profile.email) {
      // anonymous submission (no phone or email field): store it without a contact
      await db.from("crm_form_submissions").insert({ form_id: form.id, data: answers, meta: { ...input.meta, locale: input.locale ?? "en" } });
      return { ok: true, message: settingsText(schema.settings, input.locale ?? "en").successMessage, redirect: schema.settings.redirectUrl || undefined };
    }
    const { data, error } = await db
      .from("contacts")
      .insert({ ...profile, source: `form:${form.slug}`, stage: "new", tags: ["form"], ...(profile.state ? { timezone: stateTimezone(profile.state) } : {}) })
      .select("id, stage, email, phone, cell_phone, do_not_contact, sms_consent, agent_mode, first_name")
      .single();
    if (error) {
      console.error("form contact insert", error);
      return { ok: false, error: "Something went wrong. Please try again." };
    }
    contact = data as Contact;
    created = true;
  }
  const { data: full } = await db.from("contacts").select("first_name, last_name, email, cell_phone, city, state, tags").eq("id", contact.id).single();

  // fill empty profile fields (never overwrite what the team already has, except a fresh cell number)
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(profile)) {
    const cur = (full as Record<string, unknown> | null)?.[k];
    if (!cur || k === "cell_phone") patch[k] = v;
  }
  if (patch.state && !(full as { state?: string } | null)?.state) patch.timezone = stateTimezone(String(patch.state));
  if (consent) Object.assign(patch, { sms_consent: true, sms_consent_source: `form: ${form.name}`, do_not_contact: contact.do_not_contact });
  const tags = Array.from(new Set([...(full?.tags ?? []), ...(rules.tags ?? []), `form:${form.slug}`]));
  patch.tags = tags;

  const { data: sub } = await db.from("crm_form_submissions").insert({ form_id: form.id, contact_id: contact.id, data: answers, meta: { ...input.meta, locale: input.locale ?? "en" } }).select("id").single();

  const stage = rules.stage && STAGE_KEYS.includes(rules.stage as Stage) ? (rules.stage as Stage) : contact.stage;
  contact = await moveStage(contact, stage, `form:${form.slug}`, patch);
  if (consent) await activity(contact.id, "sms_consent", { source: `form: ${form.name}` }, `form:${form.slug}`);

  const qa = fields.filter((f) => f.type !== "statement" && f.type !== "consent").map((f) => `${f.label}: ${show(f, answers[f.id])}`).join("\n");
  await db.from("notes").insert({ contact_id: contact.id, author_kind: "system", body: `Form submitted: ${form.name}\n${qa}${consent ? "\nText consent: yes" : ""}` });
  await activity(contact.id, "form_submitted", { form: form.slug, form_name: form.name, submission_id: sub?.id ?? null }, `form:${form.slug}`);

  // assistant memory: answers become facts it can use in the conversation
  const facts: Record<string, string> = {};
  for (const f of fields) if (f.type !== "statement" && f.type !== "consent" && !f.map && answers[f.id] != null && answers[f.id] !== "") facts[f.label.slice(0, 60)] = show(f, answers[f.id]).slice(0, 200);
  const { data: mem } = await db.from("agent_memory").select("facts").eq("contact_id", contact.id).maybeSingle();
  await db.from("agent_memory").upsert({ contact_id: contact.id, facts: { ...((mem?.facts as Record<string, unknown>) ?? {}), ...facts }, updated_at: new Date().toISOString() });

  if (rules.task) await db.from("tasks").insert({ contact_id: contact.id, title: `Follow up: ${full?.first_name ?? profile.first_name ?? "driver"} sent "${form.name}"`.slice(0, 300), due_at: new Date(Date.now() + 3600_000).toISOString(), created_by: "workflow" });

  // automations ("When a form is submitted", filter by form)
  const { emit } = await import("@/lib/automations/engine");
  await emit("form_submitted", contact.id, { form: form.slug });

  // assistant answers like a recruiter would (only reachable channels; it checks consent itself)
  if (rules.assistant === "reply" && contact.agent_mode === "auto" && !contact.do_not_contact)
    await db.from("agent_runs").insert({ contact_id: contact.id, trigger: "form_submitted", action: "queued", decision: { form: form.name, sendDriverForm: !!rules.sendDriverForm } });

  if (rules.telegram) {
    const { sendTelegram, esc } = await import("@/lib/integrations/telegram");
    const name = [full?.first_name ?? profile.first_name, full?.last_name ?? profile.last_name].filter(Boolean).join(" ") || "Someone";
    await sendTelegram(
      `📝 <b>${esc(form.name)}</b>: ${esc(name)}${created ? " (new contact)" : ""}\n` +
        `${profile.cell_phone ?? full?.cell_phone ? `📞 ${esc(profile.cell_phone ?? full?.cell_phone)}\n` : ""}\n${esc(qa).slice(0, 2500)}\n\n<a href="${siteUrl()}/crm/contacts/${contact.id}">Open in GRL Command</a>`,
    );
  }
  return { ok: true, message: settingsText(schema.settings, input.locale ?? "en").successMessage, redirect: schema.settings.redirectUrl || undefined };
}
