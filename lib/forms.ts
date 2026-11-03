import { z } from "zod";

export const SMS_CONSENT_TEXT = {
  en: "I agree to receive calls and text messages from Global Runners Logistics LLC about my application and job opportunities at the number I provided, including automated messages. Consent is not a condition of employment. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.",
  es: "Acepto recibir llamadas y mensajes de texto de Global Runners Logistics LLC sobre mi aplicación y oportunidades de trabajo al número que proporcioné, incluyendo mensajes automatizados. El consentimiento no es condición de empleo. La frecuencia de mensajes varía. Pueden aplicar tarifas de mensajes y datos. Responde STOP para cancelar, HELP para ayuda.",
} as const;

const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[^\d+]/g, ""))
  .refine((v) => /^\+?1?\d{10}$/.test(v), "Enter a valid US phone number");

const optionalEmail = z
  .string()
  .trim()
  .max(254)
  .optional()
  .transform((v) => (v ? v.toLowerCase() : undefined))
  .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email");

const yesNo = z.enum(["yes", "no"]);
const locale = z.enum(["en", "es"]).default("en");

export const driverLeadSchema = z.object({
  first_name: z.string().trim().min(1, "Required").max(60),
  last_name: z.string().trim().min(1, "Required").max(60),
  phone,
  email: optionalEmail,
  zip: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^\d{5}$/.test(v), "5-digit ZIP"),
  locale,
  driver_type: z.enum(["solo", "team", "either"]),
  run_types: z.array(z.enum(["otr", "regional", "dedicated"])).default([]),
  has_team_partner: yesNo.optional(),
  has_cdl_a: yesNo,
  experience: z.enum(["lt1", "1-2", "3-5", "5plus"]),
  endorsements: z.array(z.enum(["hazmat", "tanker", "doubles", "twic", "none"])).default([]),
  moving_violations: z.enum(["0", "1", "2", "3", "4plus"]),
  accidents: z.enum(["0", "1", "2plus"]),
  dui: yesNo,
  drug_test_issue: yesNo,
  work_authorized: yesNo,
  over_21: yesNo,
  sms_consent: z.boolean().default(false),
  // honeypot
  company_website: z.string().max(0).optional(),
  utm: z.record(z.string(), z.string().max(200)).default({}),
  referrer: z.string().max(500).optional(),
  landing_page: z.string().max(500).optional(),
});
export type DriverLeadInput = z.input<typeof driverLeadSchema>;

export const ownerLeadSchema = z.object({
  first_name: z.string().trim().min(1, "Required").max(60),
  last_name: z.string().trim().min(1, "Required").max(60),
  phone,
  email: optionalEmail,
  locale,
  truck_year: z.coerce.number().int().min(1990).max(2030).optional(),
  truck_make: z.string().trim().max(60).optional(),
  truck_model: z.string().trim().max(60).optional(),
  trailer: z.enum(["none", "own_dry_van", "other"]).optional(),
  own_authority: yesNo.optional(),
  years_owner_operator: z.enum(["lt1", "1-2", "3-5", "5plus"]).optional(),
  home_base: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
  sms_consent: z.boolean().default(false),
  company_website: z.string().max(0).optional(),
  utm: z.record(z.string(), z.string().max(200)).default({}),
  referrer: z.string().max(500).optional(),
  landing_page: z.string().max(500).optional(),
});
export type OwnerLeadInput = z.input<typeof ownerLeadSchema>;

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Required").max(120),
  email: optionalEmail,
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(/[^\d+]/g, "") : undefined))
    .refine((v) => !v || /^\+?1?\d{10}$/.test(v), "Enter a valid US phone number"),
  topic: z.enum(["driving", "owner_operator", "shipper", "other"]),
  message: z.string().trim().min(1, "Required").max(4000),
  locale,
  sms_consent: z.boolean().default(false),
  company_website: z.string().max(0).optional(),
});
export type ContactInput = z.input<typeof contactSchema>;

export type ActionResult = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function fieldErrors(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Normalize to E.164 (+1XXXXXXXXXX). */
export const toE164 = (p: string) => {
  const d = p.replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? `+${d}` : `+1${d.slice(-10)}`;
};
