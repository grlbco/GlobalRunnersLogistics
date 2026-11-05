/**
 * Form schema for the Forms module.
 * Shape (pages of fields, field types, validation keys) adapted from Ikiform (MIT, © 2025 Preet Suthar,
 * https://github.com/preetsuthar17/ikiform), plus CRM mapping so answers land on the driver's profile.
 * Shared by the builder, the public renderer and the server validator.
 */
import { z } from "zod";
import { SMS_CONSENT_TEXT } from "@/lib/forms";

export const FIELD_TYPES = {
  text: { label: "Short text", input: true },
  textarea: { label: "Long text", input: true },
  email: { label: "Email", input: true },
  phone: { label: "Phone", input: true },
  number: { label: "Number", input: true },
  select: { label: "Dropdown", input: true, options: true },
  radio: { label: "Single choice", input: true, options: true },
  checkbox: { label: "Multiple choice", input: true, options: true },
  yesno: { label: "Yes / No", input: true },
  date: { label: "Date", input: true },
  consent: { label: "Text consent (TCPA)", input: true },
  statement: { label: "Text block", input: false },
} as const;
export type FieldType = keyof typeof FIELD_TYPES;

/** Where an answer goes on the contact. */
export const CRM_MAP = {
  "": "Don't save to profile",
  first_name: "First name",
  last_name: "Last name",
  full_name: "Full name",
  email: "Email",
  cell_phone: "Cell phone",
  city: "City",
  state: "State",
} as const;
export type CrmMap = keyof typeof CRM_MAP;

export type FormField = {
  id: string;
  type: FieldType;
  label: string;
  description?: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  map?: CrmMap;
  validation?: { minLength?: number; maxLength?: number; min?: number; max?: number };
};
export type FormPage = { id: string; title?: string; fields: FormField[] };
export type FormSettings = { title?: string; description?: string; submitText?: string; successMessage?: string; redirectUrl?: string; showProgress?: boolean };
export type FormSchema = { pages: FormPage[]; settings: FormSettings };

export type OnSubmit = {
  stage?: string;               // move the card (forward only)
  tags?: string[];              // add tags
  assistant?: "none" | "reply"; // assistant texts/emails a thank-you + next step
  telegram?: boolean;           // alert Ken's group
  task?: boolean;               // task for the team
  sendDriverForm?: boolean;     // assistant includes the driver application link
};

/** Same consent wording as the driver application (one source of truth). */
export const SMS_CONSENT_LABEL: string = SMS_CONSENT_TEXT.en;

export const newId = () => Math.random().toString(36).slice(2, 10);

export function emptySchema(title = "New form"): FormSchema {
  return { pages: [{ id: newId(), fields: [] }], settings: { title, submitText: "Submit", successMessage: "Thanks! We got it. Someone from our team will reach out soon.", showProgress: true } };
}

export function newField(type: FieldType): FormField {
  const base: FormField = { id: newId(), type, label: FIELD_TYPES[type].label, required: false };
  if (type === "select" || type === "radio" || type === "checkbox") base.options = ["Option 1", "Option 2"];
  if (type === "email") Object.assign(base, { label: "Email", map: "email" });
  if (type === "phone") Object.assign(base, { label: "Cell phone", map: "cell_phone", required: true });
  if (type === "consent") Object.assign(base, { label: SMS_CONSENT_LABEL });
  if (type === "yesno") base.label = "Yes or no?";
  if (type === "statement") Object.assign(base, { label: "A short note for the driver" });
  return base;
}

/** Ready-made forms (trucking). */
export const TEMPLATES: Record<string, { name: string; schema: FormSchema; on_submit: OnSubmit }> = {
  quick_interest: {
    name: "Quick interest",
    schema: {
      settings: { title: "Interested in driving with Global Runners?", description: "Takes 30 seconds. Ken or someone from the team will reach out.", submitText: "Send", successMessage: "Got it, thanks! Someone from our team will reach out soon.", showProgress: false },
      pages: [{ id: "p1", fields: [
        { id: "fn", type: "text", label: "First name", required: true, map: "first_name" },
        { id: "ln", type: "text", label: "Last name", required: true, map: "last_name" },
        { id: "ph", type: "phone", label: "Cell phone", required: true, map: "cell_phone" },
        { id: "cdl", type: "yesno", label: "Do you have a CDL-A?", required: true },
        { id: "exp", type: "radio", label: "How much CDL-A experience?", required: true, options: ["Under 1 year", "1-2 years", "3-5 years", "5+ years"] },
        { id: "ok", type: "consent", label: SMS_CONSENT_LABEL, required: false },
      ] }],
    },
    on_submit: { stage: "interested", tags: ["quick-interest"], assistant: "reply", telegram: true, sendDriverForm: true },
  },
  owner_operator: {
    name: "Owner-operator interest",
    schema: {
      settings: { title: "Owner-operators: lease on with Global Runners", description: "Tell us about your truck. Ken goes over the terms himself.", submitText: "Send", successMessage: "Thanks! Ken will reach out to go over the terms.", showProgress: true },
      pages: [
        { id: "p1", title: "You", fields: [
          { id: "fn", type: "text", label: "First name", required: true, map: "first_name" },
          { id: "ln", type: "text", label: "Last name", required: true, map: "last_name" },
          { id: "ph", type: "phone", label: "Cell phone", required: true, map: "cell_phone" },
          { id: "em", type: "email", label: "Email", required: false, map: "email" },
          { id: "st", type: "text", label: "Home state", required: false, map: "state" },
        ] },
        { id: "p2", title: "Your truck", fields: [
          { id: "yr", type: "number", label: "Truck year", required: true, validation: { min: 1990, max: 2030 } },
          { id: "mk", type: "select", label: "Make", required: true, options: ["Freightliner", "Peterbilt", "Kenworth", "Volvo", "International", "Mack", "Other"] },
          { id: "trl", type: "yesno", label: "Do you have your own trailer?", required: true },
          { id: "auth", type: "yesno", label: "Do you have your own MC authority?", required: true },
          { id: "best", type: "text", label: "Best time for Ken to call", required: false },
          { id: "ok", type: "consent", label: SMS_CONSENT_LABEL, required: false },
        ] },
      ],
    },
    on_submit: { stage: "interested", tags: ["owner-operator"], assistant: "none", telegram: true, task: true },
  },
  referral: {
    name: "Driver referral",
    schema: {
      settings: { title: "Refer a driver", description: "Know a good CDL-A driver? Send them our way.", submitText: "Send referral", successMessage: "Thanks for the referral!", showProgress: false },
      pages: [{ id: "p1", fields: [
        { id: "fn", type: "text", label: "Driver's first name", required: true, map: "first_name" },
        { id: "ln", type: "text", label: "Driver's last name", required: false, map: "last_name" },
        { id: "ph", type: "phone", label: "Driver's cell phone", required: true, map: "cell_phone" },
        { id: "by", type: "text", label: "Your name", required: true },
        { id: "note", type: "textarea", label: "Anything we should know?", required: false },
      ] }],
    },
    // a referred driver never agreed to texts: no assistant, a person calls
    on_submit: { stage: "new", tags: ["referral"], assistant: "none", telegram: true, task: true },
  },
};

// ---------------- validation (server + client) ----------------

const PHONE = /^\+?1?\D*([2-9]\d{2})\D*(\d{3})\D*(\d{4})$/;
export const normPhone = (v: string) => {
  const m = v.trim().match(PHONE);
  return m ? `+1${m[1]}${m[2]}${m[3]}` : null;
};

export type Answers = Record<string, string | string[] | boolean | number | null>;

/** Returns field id → error message for one page (or the whole form). */
export function validate(fields: FormField[], a: Answers): Record<string, string> {
  const err: Record<string, string> = {};
  for (const f of fields) {
    if (f.type === "statement") continue;
    const v = a[f.id];
    const empty = v == null || v === "" || (Array.isArray(v) && !v.length) || (f.type === "consent" && v !== true);
    if (empty) {
      if (f.required) err[f.id] = f.type === "consent" ? "Please tick the box to continue." : "Required";
      continue;
    }
    const s = String(v).trim();
    if (f.type === "email" && !z.string().email().safeParse(s).success) err[f.id] = "Enter a valid email";
    if (f.type === "phone" && !normPhone(s)) err[f.id] = "Enter a valid US phone number";
    if (f.type === "number") {
      const n = Number(s);
      if (!Number.isFinite(n)) err[f.id] = "Enter a number";
      else if (f.validation?.min != null && n < f.validation.min) err[f.id] = `At least ${f.validation.min}`;
      else if (f.validation?.max != null && n > f.validation.max) err[f.id] = `At most ${f.validation.max}`;
    }
    if ((f.type === "text" || f.type === "textarea") && s.length > (f.validation?.maxLength ?? (f.type === "text" ? 200 : 3000))) err[f.id] = "Too long";
    if ((f.type === "select" || f.type === "radio") && !(f.options ?? []).includes(s)) err[f.id] = "Pick one of the options";
    if (f.type === "checkbox" && (!Array.isArray(v) || v.some((x) => !(f.options ?? []).includes(String(x))))) err[f.id] = "Pick from the options";
    if (f.type === "yesno" && !["Yes", "No"].includes(s)) err[f.id] = "Pick yes or no";
  }
  return err;
}

export const allFields = (s: FormSchema) => s.pages.flatMap((p) => p.fields);

/** Zod guard for schemas saved from the builder. */
const fieldZ = z.object({
  id: z.string().min(1).max(40),
  type: z.enum(Object.keys(FIELD_TYPES) as [FieldType, ...FieldType[]]),
  label: z.string().max(600),
  description: z.string().max(600).optional(),
  placeholder: z.string().max(200).optional(),
  required: z.boolean(),
  options: z.array(z.string().max(200)).max(50).optional(),
  map: z.enum(Object.keys(CRM_MAP) as [CrmMap, ...CrmMap[]]).optional(),
  validation: z.object({ minLength: z.number().optional(), maxLength: z.number().optional(), min: z.number().optional(), max: z.number().optional() }).optional(),
});
export const schemaZ = z.object({
  pages: z.array(z.object({ id: z.string().min(1).max(40), title: z.string().max(200).optional(), fields: z.array(fieldZ).max(60) })).min(1).max(20),
  settings: z.object({ title: z.string().max(200).optional(), description: z.string().max(1000).optional(), submitText: z.string().max(40).optional(), successMessage: z.string().max(500).optional(), redirectUrl: z.string().url().optional().or(z.literal("")), showProgress: z.boolean().optional() }),
});
export const onSubmitZ = z.object({
  stage: z.string().max(40).optional(),
  tags: z.array(z.string().max(40)).max(10).optional(),
  assistant: z.enum(["none", "reply"]).optional(),
  telegram: z.boolean().optional(),
  task: z.boolean().optional(),
  sendDriverForm: z.boolean().optional(),
});
