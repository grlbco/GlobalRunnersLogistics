"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { notifyRecruiter, sendEmail, sendSms } from "@/lib/notify";
import {
  SMS_CONSENT_TEXT,
  contactSchema,
  driverLeadSchema,
  fieldErrors,
  ownerLeadSchema,
  toE164,
  type ActionResult,
  type ContactInput,
  type DriverLeadInput,
  type OwnerLeadInput,
} from "@/lib/forms";
import { company } from "@/content/facts";

// Best-effort per-instance rate limit (serverless instances don't share memory; RLS + checks still apply).
const hits = new Map<string, number[]>();
function limited(key: string, max = 5, windowMs = 10 * 60_000) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
}

async function requestMeta() {
  const h = await headers();
  return {
    ip: (h.get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 64) || null,
    ua: (h.get("user-agent") ?? "").slice(0, 500) || null,
  };
}

const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);
const yn = (v?: string) => (v === "yes" ? "Yes" : v === "no" ? "No" : "—");
const yes = (v?: string) => (v === undefined ? null : v === "yes");

export async function submitDriverLead(input: DriverLeadInput): Promise<ActionResult> {
  const parsed = driverLeadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;
  if (d.company_website) return { ok: true }; // bot
  const meta = await requestMeta();
  if (limited(`driver:${meta.ip}`)) return { ok: false, error: "Too many submissions. Please call us instead." };

  const flags: string[] = [];
  if (d.has_cdl_a === "no") flags.push("no_cdl_a");
  if (d.experience === "lt1") flags.push("under_1yr");
  if (d.moving_violations === "4plus") flags.push("violations_4plus");
  if (d.dui === "yes") flags.push("dui");
  if (d.drug_test_issue === "yes") flags.push("drug_test_or_sap");
  if (d.over_21 === "no") flags.push("under_21");
  if (d.work_authorized === "no") flags.push("not_work_authorized");

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const phone = toE164(d.phone);

  const { error } = await supabase.from("driver_leads").insert({
    user_id: (claims?.claims?.sub as string | undefined) ?? null,
    first_name: d.first_name,
    last_name: d.last_name,
    phone,
    email: d.email ?? null,
    zip: d.zip || null,
    locale: d.locale,
    driver_type: d.driver_type,
    run_types: d.run_types,
    has_team_partner: yes(d.has_team_partner),
    has_cdl_a: d.has_cdl_a === "yes",
    experience: d.experience,
    endorsements: d.endorsements,
    moving_violations: d.moving_violations,
    accidents: d.accidents,
    dui: d.dui === "yes",
    drug_test_issue: d.drug_test_issue === "yes",
    work_authorized: d.work_authorized === "yes",
    over_21: d.over_21 === "yes",
    sms_consent: d.sms_consent,
    flags,
    utm: d.utm,
    referrer: d.referrer ?? null,
    landing_page: d.landing_page ?? null,
  });
  if (error) {
    console.error("driver_leads insert", error);
    return { ok: false, error: `Something went wrong. Please call ${company.phone.display}.` };
  }

  await supabase.from("consents").insert({
    source: "driver_lead",
    phone,
    email: d.email ?? null,
    consent_text: SMS_CONSENT_TEXT[d.locale],
    granted: d.sms_consent,
    ip: meta.ip,
    user_agent: meta.ua,
    page: d.landing_page ?? null,
  });

  const name = `${d.first_name} ${d.last_name}`;
  const exp = { lt1: "<1 yr", "1-2": "1–2 yrs", "3-5": "3–5 yrs", "5plus": "5+ yrs" }[d.experience];

  // CRM: link to the driver's profile (or create one), move to Applied, stop follow-ups, task for Ken.
  let crmLink: string | null = null;
  try {
    const { adminDb } = await import("@/lib/crm/admin");
    const { completeForm } = await import("@/lib/crm/forms");
    const { data: lead } = await adminDb().from("driver_leads").select("id").eq("phone", phone).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const contactId = await completeForm({
      token: d.t ?? null,
      first_name: d.first_name,
      last_name: d.last_name,
      phone,
      email: d.email ?? null,
      zip: d.zip || null,
      sms_consent: d.sms_consent,
      driverLeadId: lead?.id ?? null,
      flags,
      answers: [
        { label: "Name", value: name },
        { label: "Mobile phone", value: phone },
        { label: "Email", value: d.email || "—" },
        { label: "ZIP", value: d.zip || "—" },
        { label: "How they want to drive", value: cap(d.driver_type) },
        { label: "Runs", value: d.run_types.length ? d.run_types.map((r) => (r === "otr" ? "OTR" : cap(r))).join(", ") : "—" },
        ...(d.driver_type !== "solo" ? [{ label: "Has a team partner", value: yn(d.has_team_partner) }] : []),
        { label: "Valid CDL-A", value: yn(d.has_cdl_a) },
        { label: "CDL-A experience", value: exp },
        { label: "Endorsements", value: d.endorsements.filter((e) => e !== "none").map((e) => (e === "twic" ? "TWIC" : cap(e))).join(", ") || "None" },
        { label: "Moving violations (3 yrs)", value: d.moving_violations === "4plus" ? "4+" : d.moving_violations },
        { label: "Accidents (3 yrs)", value: d.accidents === "2plus" ? "2+" : d.accidents },
        { label: "Ever had a DUI", value: yn(d.dui) },
        { label: "Failed/refused drug test or SAP", value: yn(d.drug_test_issue) },
        { label: "21 or older", value: yn(d.over_21) },
        { label: "Authorized to work in the U.S.", value: yn(d.work_authorized) },
        { label: "OK to text", value: d.sms_consent ? "Yes" : "No" },
        { label: "Language", value: d.locale === "es" ? "Spanish" : "English" },
      ],
      summary: [
        `Type: ${d.driver_type}${d.run_types.length ? ` (${d.run_types.join(", ")})` : ""}`,
        `CDL-A: ${d.has_cdl_a} · Experience: ${exp}`,
        `Endorsements: ${d.endorsements.join(", ") || "none"}`,
        `Violations (3y): ${d.moving_violations} · Accidents (3y): ${d.accidents} · DUI: ${d.dui} · Drug test/SAP: ${d.drug_test_issue}`,
        `21+: ${d.over_21} · Work authorized: ${d.work_authorized} · ZIP: ${d.zip || "—"} · Language: ${d.locale.toUpperCase()}`,
      ].join("\n"),
    });
    if (contactId) crmLink = `${process.env.NEXT_PUBLIC_SITE_URL || company.url}/crm/contacts/${contactId}`;
  } catch (e) {
    console.error("crm completeForm", e);
  }
  await Promise.allSettled([
    notifyRecruiter({
      subject: `New driver lead: ${name} (${d.driver_type}, ${exp})${flags.length ? " ⚠" : ""}`,
      sms: `New CDL-A ${d.driver_type} applicant: ${name}, ${exp}, ${d.moving_violations} violations${flags.length ? `, flags: ${flags.join(", ")}` : ""}. Call ${phone}`,
      rows: [
        ["Name", name],
        ["Phone", phone],
        ["Email", d.email],
        ["ZIP", d.zip],
        ["Language", d.locale.toUpperCase()],
        ["Driver type", d.driver_type],
        ["Runs", d.run_types.join(", ")],
        ["Team partner", d.has_team_partner],
        ["CDL-A", d.has_cdl_a],
        ["Experience", exp],
        ["Endorsements", d.endorsements.join(", ")],
        ["Moving violations (3 yrs)", d.moving_violations],
        ["Accidents (3 yrs)", d.accidents],
        ["DUI", d.dui],
        ["Drug test issue / SAP", d.drug_test_issue],
        ["Work authorized", d.work_authorized],
        ["21+", d.over_21],
        ["SMS consent", d.sms_consent ? "yes" : "no"],
        ["Flags", flags.join(", ")],
        ["Source", [d.utm.utm_source, d.utm.utm_campaign].filter(Boolean).join(" / ") || d.referrer],
        ["CRM profile", crmLink],
      ],
    }),
    // When the CRM handled it, the confirmation text goes through the CRM outbox instead (shows in the timeline).
    d.sms_consent && !crmLink
      ? sendSms(
          phone,
          d.locale === "es"
            ? `Gracias por aplicar a Global Runners Logistics, ${d.first_name}. Te llamaremos pronto desde ${company.phone.display}. Responde STOP para cancelar.`
            : `Thanks for applying to Global Runners Logistics, ${d.first_name}. We'll call you shortly from ${company.phone.display}. Reply STOP to opt out.`,
        )
      : Promise.resolve(),
    d.email
      ? sendEmail(
          d.email,
          d.locale === "es" ? "Recibimos tu aplicación, Global Runners Logistics" : "We got your application, Global Runners Logistics",
          confirmationHtml(d.locale, d.first_name),
          d.locale === "es"
            ? `Hola ${d.first_name}, recibimos tu aplicación. Nuestro equipo te llamará pronto desde ${company.phone.display}.`
            : `Hi ${d.first_name}, we got your application. Our hiring team will call you shortly from ${company.phone.display}.`,
        )
      : Promise.resolve(),
  ]);

  return { ok: true };
}

export async function submitOwnerLead(input: OwnerLeadInput): Promise<ActionResult> {
  const parsed = ownerLeadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;
  if (d.company_website) return { ok: true };
  const meta = await requestMeta();
  if (limited(`oo:${meta.ip}`)) return { ok: false, error: "Too many submissions. Please call us instead." };

  const supabase = await createClient();
  const phone = toE164(d.phone);
  const { error } = await supabase.from("owner_operator_leads").insert({
    first_name: d.first_name,
    last_name: d.last_name,
    phone,
    email: d.email ?? null,
    locale: d.locale,
    truck_year: d.truck_year ?? null,
    truck_make: d.truck_make || null,
    truck_model: d.truck_model || null,
    trailer: d.trailer ?? null,
    own_authority: yes(d.own_authority),
    years_owner_operator: d.years_owner_operator ?? null,
    home_base: d.home_base || null,
    notes: d.notes || null,
    sms_consent: d.sms_consent,
    utm: d.utm,
    referrer: d.referrer ?? null,
    landing_page: d.landing_page ?? null,
  });
  if (error) {
    console.error("owner_operator_leads insert", error);
    return { ok: false, error: `Something went wrong. Please call ${company.phone.display}.` };
  }
  await supabase.from("consents").insert({
    source: "owner_operator_lead",
    phone,
    email: d.email ?? null,
    consent_text: SMS_CONSENT_TEXT[d.locale],
    granted: d.sms_consent,
    ip: meta.ip,
    user_agent: meta.ua,
    page: d.landing_page ?? null,
  });
  const name = `${d.first_name} ${d.last_name}`;
  await notifyRecruiter({
    subject: `New owner-operator lead: ${name}`,
    sms: `New owner-operator lead: ${name}, ${[d.truck_year, d.truck_make, d.truck_model].filter(Boolean).join(" ") || "truck n/a"}. Call ${phone}`,
    rows: [
      ["Name", name],
      ["Phone", phone],
      ["Email", d.email],
      ["Truck", [d.truck_year, d.truck_make, d.truck_model].filter(Boolean).join(" ")],
      ["Trailer", d.trailer],
      ["Own authority", d.own_authority],
      ["Years as O/O", d.years_owner_operator],
      ["Home base", d.home_base],
      ["Notes", d.notes],
      ["SMS consent", d.sms_consent ? "yes" : "no"],
    ],
  });
  return { ok: true };
}

export async function submitContact(input: ContactInput): Promise<ActionResult> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;
  if (d.company_website) return { ok: true };
  if (!d.email && !d.phone) return { ok: false, error: "Add an email or phone so we can reply.", fieldErrors: { email: "Email or phone required" } };
  const meta = await requestMeta();
  if (limited(`contact:${meta.ip}`)) return { ok: false, error: "Too many submissions. Please call us instead." };

  const supabase = await createClient();
  const phone = d.phone ? toE164(d.phone) : null;
  const { error } = await supabase.from("contact_messages").insert({
    name: d.name,
    email: d.email ?? null,
    phone,
    topic: d.topic,
    message: d.message,
    locale: d.locale,
    sms_consent: d.sms_consent,
  });
  if (error) {
    console.error("contact insert", error);
    return { ok: false, error: `Something went wrong. Please call ${company.phone.display}.` };
  }
  if (phone) {
    await supabase.from("consents").insert({
      source: "contact",
      phone,
      email: d.email ?? null,
      consent_text: SMS_CONSENT_TEXT[d.locale],
      granted: d.sms_consent,
      ip: meta.ip,
      user_agent: meta.ua,
    });
  }
  await notifyRecruiter({
    subject: `Website message (${d.topic}): ${d.name}`,
    sms: `Website message from ${d.name} (${d.topic}). ${phone ?? d.email}`,
    rows: [
      ["Name", d.name],
      ["Email", d.email],
      ["Phone", phone],
      ["Topic", d.topic],
      ["Message", d.message],
    ],
  });
  return { ok: true };
}

/** Confirmation email after a driver applies: what happens next, nothing else to do. */
function confirmationHtml(locale: "en" | "es", firstName: string) {
  const es = locale === "es";
  const f = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const steps = es
    ? ["Revisamos tu aplicación.", `Te llamamos desde ${company.phone.display} para hablar de la ruta y el pago.`, "Orientación de 1 día en Henderson, NV, con tu viaje pagado."]
    : ["We review your application.", `We call you from ${company.phone.display} to talk lanes and pay.`, "1-day orientation in Henderson, NV, with your travel covered."];
  const li = steps
    .map((t, i) => `<tr><td style="${f};padding:6px 12px 6px 0;vertical-align:top;color:#e8401c;font-weight:700;font-size:15px">${i + 1}</td><td style="${f};padding:6px 0;font-size:15px;color:#1a1a1a">${t}</td></tr>`)
    .join("");
  return `<div style="background:#f4f5f7;padding:24px 12px"><table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:10px" cellpadding="0" cellspacing="0"><tr><td style="padding:28px 28px 8px">
<p style="${f};margin:0 0 4px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#6b7280">Global Runners Logistics</p>
<p style="${f};margin:0 0 16px;font-size:22px;font-weight:700;color:#0a1220">${es ? `¡Listo, ${firstName}!` : `You're all set, ${firstName}.`}</p>
<p style="${f};margin:0 0 16px;font-size:15px;line-height:1.5;color:#1a1a1a">${es ? "Recibimos tu aplicación. No tienes que hacer nada más. Esto es lo que sigue:" : "We got your application. There's nothing else you need to do. Here's what happens next:"}</p>
<table role="presentation" cellpadding="0" cellspacing="0">${li}</table>
<p style="${f};margin:20px 0 0;font-size:15px;line-height:1.5;color:#1a1a1a">${es ? "¿Prefieres llamar tú? Llámanos o escríbenos al" : "Rather call us first? Call or text"} <a href="tel:${company.phone.e164}" style="color:#e8401c;font-weight:600;text-decoration:none">${company.phone.display}</a>.</p>
</td></tr><tr><td style="padding:20px 28px 28px"><p style="${f};margin:0;font-size:13px;color:#6b7280">${es ? "Equipo de contratación" : "Hiring team"}, Global Runners Logistics<br/>732 S 6th St, Ste V, Las Vegas, NV 89101</p></td></tr></table></div>`;
}
