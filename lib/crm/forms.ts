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
    const { data: c } = await db.from("contacts").select("id, stage, email, phone, cell_phone, do_not_contact, sms_consent, agent_mode, first_name").eq("id", link.contact_id).maybeSingle();
    if (c) await moveStage(c as Contact, "form_sent", "website", {}, { reason: "Driver opened the form" });
    const { emit } = await import("@/lib/automations/engine");
    await emit("form_opened", link.contact_id, {});
  }
}

export type Completion = {
  token?: string | null;
  first_name: string; last_name: string; phone: string; email?: string | null; zip?: string | null;
  sms_consent: boolean; driverLeadId?: string | null; summary: string; flags: string[];
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
  // A person decides anything flagged: the form never rejects a driver on its own.
  const flagged = f.flags.some((x) => ["no_cdl_a", "under_1yr", "dui", "drug_test_or_sap", "under_21"].includes(x));
  await moveStage(contact, "applied", "website", patch, { reason: "Driver submitted the form" });

  const now = new Date().toISOString();
  if (token) await db.from("form_links").update({ completed_at: now, step_reached: 5 }).eq("token", token);
  else await db.from("form_links").insert({ contact_id: contact.id, opened_at: now, completed_at: now, step_reached: 5 });

  await db.from("followups").update({ status: "cancelled" }).eq("contact_id", contact.id).eq("status", "pending");
  await db.from("outbox").update({ status: "cancelled", error: "form completed" }).eq("contact_id", contact.id).eq("author", "agent").in("status", ["draft", "pending"]);
  await db.from("notes").insert({ contact_id: contact.id, author_kind: "system", body: `Driver form completed.\n${f.summary}${f.flags.length ? `\nFlags: ${f.flags.join(", ")}` : ""}` });
  await activity(contact.id, "form_completed", { flags: f.flags }, "website");
  const { emit } = await import("@/lib/automations/engine");
  await emit("form_completed", contact.id, {});
  if (flagged) {
    await db.from("tasks").insert({ contact_id: contact.id, title: `Review ${f.first_name} ${f.last_name}'s form: ${f.flags.join(", ")}`.slice(0, 300), due_at: new Date(Date.now() + 3600_000).toISOString(), created_by: "agent" });
  } else {
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
  await db.from("agent_memory").upsert({ contact_id: contact.id, next_step: !flagged ? "Form completed. Waiting for Ken's call." : "Form completed, flagged as not a fit.", updated_at: now });

  // Telegram alert to Ken's group
  try {
    const { sendTelegram, esc } = await import("@/lib/integrations/telegram");
    const { siteUrl } = await import("@/lib/site");
    const { data: full } = await db.from("contacts").select("state, city, tags").eq("id", contact.id).single();
    await sendTelegram(
      `${!flagged ? "✅ <b>New driver form submitted</b>" : "⚠️ <b>Form submitted, needs review</b>"}\n` +
        `<b>${esc(f.first_name)} ${esc(f.last_name)}</b>${full?.state ? ` · ${esc([full.city, full.state].filter(Boolean).join(", "))}` : ""}\n` +
        `📞 ${esc(f.phone)}${f.email ? `\n✉️ ${esc(f.email)}` : ""}\n\n${esc(f.summary)}` +
        `${f.flags.length ? `\n\nFlags: ${esc(f.flags.join(", "))}` : ""}\n\n<a href="${siteUrl()}/crm/contacts/${contact.id}">Open in GRL Command</a>`,
    );
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

