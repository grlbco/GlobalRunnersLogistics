import "server-only";
import { adminDb } from "./admin";
import { activity, contactByEmail, contactByPhone, moveStage, type Contact } from "./ingest";

/** Personal form links: prefill, progress tracking, completion → CRM. */
export type Prefill = { first_name?: string; last_name?: string; phone?: string; email?: string };

const TOKEN = /^[0-9a-f]{24}$/;

export async function prefillForToken(token?: string | null): Promise<Prefill | null> {
  if (!token || !TOKEN.test(token)) return null;
  const db = adminDb();
  const { data } = await db.from("form_links").select("contact:contacts(first_name, last_name, cell_phone, phone, email)").eq("token", token).maybeSingle();
  const c = data?.contact as unknown as { first_name: string | null; last_name: string | null; cell_phone: string | null; phone: string | null; email: string | null } | null;
  if (!c) return null;
  const phone = c.cell_phone ?? c.phone;
  return {
    first_name: c.first_name ?? undefined,
    last_name: c.last_name ?? undefined,
    phone: phone ? phone.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3") : undefined,
    email: c.email ?? undefined,
  };
}

const CODE = /^[A-Za-z0-9]{6,10}$/;

/** Short link /a/<code> → the personal token behind it, plus prefill. Null if unknown. */
export async function linkForCode(code?: string | null): Promise<{ token: string; prefill: Prefill; completed: boolean } | null> {
  if (!code || !CODE.test(code)) return null;
  const { data } = await adminDb().from("form_links").select("token, completed_at").eq("code", code).maybeSingle();
  if (!data) return null;
  const prefill = await prefillForToken(data.token);
  return prefill ? { token: data.token, prefill, completed: !!data.completed_at } : null;
}

export async function trackStep(token: string, step: number) {
  if (!TOKEN.test(token)) return;
  const db = adminDb();
  const { data: link } = await db.from("form_links").select("contact_id, opened_at, step_reached, completed_at").eq("token", token).maybeSingle();
  if (!link || link.completed_at) return;
  const patch: Record<string, unknown> = {};
  if (!link.opened_at) patch.opened_at = new Date().toISOString();
  if (step > (link.step_reached ?? 0)) patch.step_reached = step;
  if (!Object.keys(patch).length) return;
  await db.from("form_links").update(patch).eq("token", token);
  if (!link.opened_at) {
    await activity(link.contact_id, "form_opened", {}, "website");
    const { emit } = await import("@/lib/automations/engine");
    await emit("form_opened", link.contact_id, {});
  }
}

export type Completion = {
  token?: string | null;
  first_name: string; last_name: string; phone: string; email?: string | null; zip?: string | null;
  sms_consent: boolean; driverLeadId?: string | null; summary: string; flags: string[];
  /** Every answer as label → value, in form order. Shown in the CRM as the submitted form. */
  answers?: { label: string; value: string }[];
};

/** A submitted driver form: link to (or create) the contact, move to Applied, stop follow-ups, task for Ken. */
export async function completeForm(f: Completion): Promise<string | null> {
  const db = adminDb();
  let contact: Contact | null = null;
  let token = f.token && TOKEN.test(f.token) ? f.token : null;
  if (token) {
    const { data } = await db.from("form_links").select("contact_id").eq("token", token).maybeSingle();
    if (data) contact = (await db.from("contacts").select("id, stage, email, phone, cell_phone, do_not_contact, sms_consent, agent_mode, first_name").eq("id", data.contact_id).single()).data as Contact;
    else token = null;
  }
  contact ??= (f.email ? await contactByEmail(f.email) : null) ?? (await contactByPhone(f.phone));
  if (!contact) {
    const { data, error } = await db
      .from("contacts")
      .insert({ first_name: f.first_name, last_name: f.last_name, cell_phone: f.phone, email: f.email?.toLowerCase() ?? null, source: "website_form", stage: "new", tags: ["website"] })
      .select("id, stage, email, phone, cell_phone, do_not_contact, sms_consent, agent_mode, first_name")
      .single();
    if (error) {
      console.error("completeForm contact insert", error);
      return null;
    }
    contact = data as Contact;
  }

  const patch: Record<string, unknown> = {
    first_name: f.first_name,
    last_name: f.last_name,
    cell_phone: f.phone,
    driver_lead_id: f.driverLeadId ?? null,
    ...(f.sms_consent ? { sms_consent: true } : {}),
  };
  if (f.email && !contact.email) patch.email = f.email.toLowerCase();
  const next = f.flags.some((x) => ["no_cdl_a", "under_1yr", "dui", "drug_test_or_sap", "under_21"].includes(x)) ? "not_fit" : "applied";
  await moveStage(contact, next, "website", patch);

  const now = new Date().toISOString();
  const answers = f.answers ?? null;
  const { data: linkRow } = token
    ? await db.from("form_links").update({ completed_at: now, step_reached: 5, answers }).eq("token", token).select("code").maybeSingle()
    : await db.from("form_links").insert({ contact_id: contact.id, opened_at: now, completed_at: now, step_reached: 5, answers }).select("code").single();
  const appCode = (linkRow?.code as string | undefined) ?? null;

  await db.from("followups").update({ status: "cancelled" }).eq("contact_id", contact.id).eq("status", "pending");
  await db.from("outbox").update({ status: "cancelled", error: "form completed" }).eq("contact_id", contact.id).eq("author", "agent").in("status", ["draft", "pending"]);
  await db.from("notes").insert({ contact_id: contact.id, author_kind: "system", body: `Driver form completed.\n${f.summary}${f.flags.length ? `\nFlags: ${f.flags.join(", ")}` : ""}` });
  await activity(contact.id, "form_completed", { flags: f.flags }, "website");
  const { emit } = await import("@/lib/automations/engine");
  await emit("form_completed", contact.id, {});
  if (next === "applied") {
    await db.from("tasks").insert({ contact_id: contact.id, title: `Call ${f.first_name} ${f.last_name}: form completed`, due_at: new Date(Date.now() + 3600_000).toISOString(), created_by: "workflow" });
    // Confirmation back to the driver, through the outbox so it shows in the timeline (texts only with consent).
    const smsOk = f.sms_consent || contact.sms_consent;
    if (smsOk && !contact.do_not_contact) {
      const first = f.first_name.trim().split(/\s+/)[0];
      const lines = [
        `Got your form ${first}, thank you. Someone from our team will reach out to you soon.`,
        `Thanks ${first}, your form came through. One of our team will call you soon.`,
        `Got it ${first}, thanks for filling that out. Someone from the team will be in touch soon.`,
      ];
      await db.from("outbox").insert({ contact_id: contact.id, channel: "sms", author: "workflow", body: lines[Math.floor(Math.random() * lines.length)], status: "pending", send_after: new Date(Date.now() + 20_000).toISOString(), is_reply: true });
    }
  }
  await db.from("agent_memory").upsert({ contact_id: contact.id, next_step: next === "applied" ? "Form completed. Waiting for our team's call." : "Form completed, flagged as not a fit.", updated_at: now });

  // Telegram alert to Ken's group: a card he can act on from his phone.
  try {
    const { sendTelegram, esc, DIVIDER } = await import("@/lib/integrations/telegram");
    const { siteUrl } = await import("@/lib/site");
    const { isConcern } = await import("@/lib/crm/applications");
    const { data: full } = await db.from("contacts").select("state, city, company_name, usdot, tier_label, sms_consent").eq("id", contact.id).single();
    const shown = f.phone.replace(/^\+?1?(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3");
    const A = new Map((f.answers ?? []).map((x) => [x.label, x.value]));
    const v = (k: string) => A.get(k) ?? "—";
    const concerns = (f.answers ?? []).filter(isConcern).map((x) => `${x.label}: ${x.value}`);
    const place = [full?.city, full?.state].filter(Boolean).join(", ");
    const row = (label: string, value: string) => `<b>${esc(label)}</b>  ${esc(value)}`;
    const ok = next === "applied" && concerns.length === 0;
    const lines = [
      next === "applied" ? `✅ <b>APPLICATION IN</b> · ${ok ? "ready for a call" : "check before calling"}` : "⛔ <b>APPLICATION IN</b> · not a fit",
      DIVIDER,
      `👤 <b>${esc(f.first_name)} ${esc(f.last_name)}</b>`,
      `📞 <a href="tel:${esc(f.phone)}">${esc(shown)}</a>  <i>confirmed on the form</i>`,
      f.email ? `✉️ ${esc(f.email)}` : null,
      full?.company_name ? `🚛 ${esc(full.company_name)}${full.usdot ? ` · USDOT ${esc(String(full.usdot))}` : ""}` : null,
      place || full?.tier_label ? `📍 ${esc([place, full?.tier_label ? `Tier ${full.tier_label}` : null].filter(Boolean).join(" · "))}` : null,
      "",
      A.size
        ? [
            row("Drives", [v("How they want to drive"), v("Runs")].filter((x) => x !== "—").join(" · ")),
            row("CDL-A", `${v("Valid CDL-A")} · ${v("CDL-A experience")}`),
            row("Endorsements", v("Endorsements")),
            row("Record", `${v("Moving violations (3 yrs)")} violations · ${v("Accidents (3 yrs)")} accidents · DUI ${v("Ever had a DUI").toLowerCase()}`),
            row("Drug test issue", v("Failed/refused drug test or SAP")),
            row("21+ / US work auth", `${v("21 or older")} / ${v("Authorized to work in the U.S.")}`),
            row("Texts OK", f.sms_consent || full?.sms_consent ? "Yes" : "No"),
          ].join("\n")
        : esc(f.summary),
      concerns.length ? `\n⚠️ <b>Check:</b> ${esc(concerns.join(" · "))}` : null,
      "",
      next === "applied" ? "➡️ Moved to <b>Applied</b>. Over to Ken: call task due in 1 hour." : "➡️ Moved to <b>Not a fit</b>.",
    ].filter((x) => x !== null) as string[];
    const buttons = [
      [
        ...(appCode ? [{ text: "📄 Application", url: `${siteUrl()}/crm/applications/${appCode}` }] : []),
        { text: "👤 Profile", url: `${siteUrl()}/crm/contacts/${contact.id}` },
      ],
    ];
    await sendTelegram(lines.join("\n"), buttons);
  } catch (e) {
    console.error("telegram alert", e);
  }
  return contact.id;
}

/**
 * Worker. Unfinished forms are chased by the assistant's follow-up cadence (lib/agent/engine.ts),
 * which already knows whether the form was opened and how far they got. This only covers links
 * sent without the assistant (no pending follow-up): they get one nudge after 2h.
 */
export async function queueAbandonedNudges() {
  const db = adminDb();
  const cutoff = new Date(Date.now() - 2 * 3600_000).toISOString();
  const { data } = await db.from("form_links").select("token, contact_id").lte("opened_at", cutoff).is("completed_at", null).is("nudged_at", null).limit(20);
  for (const l of data ?? []) {
    await db.from("form_links").update({ nudged_at: new Date().toISOString() }).eq("token", l.token);
    const { count } = await db.from("followups").select("*", { count: "exact", head: true }).eq("contact_id", l.contact_id).eq("status", "pending");
    if (count) continue;
    await db.from("agent_runs").insert({ contact_id: l.contact_id, trigger: "form_abandoned", action: "queued" });
  }
  return data?.length ?? 0;
}

