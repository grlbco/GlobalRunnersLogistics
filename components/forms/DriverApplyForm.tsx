"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { clsx } from "clsx";
import { submitDriverLead } from "@/app/actions/leads";
import { SMS_CONSENT_TEXT, type DriverLeadInput } from "@/lib/forms";
import { Checkbox, Chips, ErrorText, Honeypot, TextField, useAttribution } from "./fields";
import { Arrow } from "@/components/ui/Button";
import { company } from "@/content/facts";
import type { Locale } from "@/lib/i18n";

type State = Partial<DriverLeadInput> & { endorsements: NonNullable<DriverLeadInput["endorsements"]>; run_types: NonNullable<DriverLeadInput["run_types"]> };

const t = {
  en: {
    steps: ["You", "The job", "Experience", "Record", "Send"],
    first: "First name",
    last: "Last name",
    phone: "Mobile phone",
    email: "Email",
    optional: "Optional",
    zip: "ZIP code",
    driverType: "How do you want to drive?",
    solo: "Solo",
    team: "Team",
    either: "Either",
    runs: "What kind of runs?",
    otr: "OTR",
    regional: "Regional",
    dedicated: "Dedicated",
    partner: "Do you have a team partner?",
    yes: "Yes",
    no: "No",
    cdl: "Do you have a valid CDL-A?",
    exp: "CDL-A driving experience",
    endorse: "Endorsements",
    none: "None",
    violations: "Moving violations in the last 3 years",
    accidents: "Accidents in the last 3 years",
    dui: "Have you ever had a DUI?",
    drug: "Ever failed or refused a drug/alcohol test, or done a SAP program?",
    auth: "Are you authorized to work in the U.S.?",
    age: "Are you 21 or older?",
    reviewTitle: "Almost done",
    reviewSub: "We'll call you from",
    consent: SMS_CONSENT_TEXT.en,
    terms: "By submitting you agree to our",
    privacy: "Privacy Policy",
    smsTerms: "SMS Terms",
    back: "Back",
    next: "Continue",
    submit: "Send application",
    sending: "Sending…",
    required: "Please answer this one",
    softNote: "Heads up: based on your answers you may not meet every requirement. Send it anyway — our recruiter reviews every application.",
    doneTitle: "Application received.",
    doneSub: (name: string) => `Thanks, ${name}. Ken will call you from ${company.phone.display} — usually within the hour during office hours (Pacific Time).`,
    doneNext: "Want to speed things up? Create your driver account and start your full application.",
    register: "Create my account",
    home: "Back to home",
  },
  es: {
    steps: ["Tú", "El trabajo", "Experiencia", "Historial", "Enviar"],
    first: "Nombre",
    last: "Apellido",
    phone: "Celular",
    email: "Correo electrónico",
    optional: "Opcional",
    zip: "Código postal",
    driverType: "¿Cómo quieres manejar?",
    solo: "Solo",
    team: "En equipo",
    either: "Cualquiera",
    runs: "¿Qué tipo de rutas?",
    otr: "OTR",
    regional: "Regional",
    dedicated: "Dedicada",
    partner: "¿Tienes compañero de equipo?",
    yes: "Sí",
    no: "No",
    cdl: "¿Tienes una licencia CDL-A vigente?",
    exp: "Experiencia manejando con CDL-A",
    endorse: "Endosos",
    none: "Ninguno",
    violations: "Infracciones de tránsito en los últimos 3 años",
    accidents: "Accidentes en los últimos 3 años",
    dui: "¿Has tenido alguna vez un DUI?",
    drug: "¿Alguna vez fallaste o rechazaste una prueba de drogas/alcohol, o hiciste un programa SAP?",
    auth: "¿Estás autorizado para trabajar en EE. UU.?",
    age: "¿Tienes 21 años o más?",
    reviewTitle: "Casi listo",
    reviewSub: "Te llamaremos desde",
    consent: SMS_CONSENT_TEXT.es,
    terms: "Al enviar aceptas nuestra",
    privacy: "Política de privacidad",
    smsTerms: "Términos de SMS",
    back: "Atrás",
    next: "Continuar",
    submit: "Enviar aplicación",
    sending: "Enviando…",
    required: "Por favor responde esta pregunta",
    softNote: "Aviso: según tus respuestas, puede que no cumplas todos los requisitos. Envíala de todos modos, nuestro reclutador revisa cada aplicación.",
    doneTitle: "Aplicación recibida.",
    doneSub: (name: string) => `Gracias, ${name}. Ken te llamará desde ${company.phone.display}, normalmente en menos de una hora en horario de oficina (hora del Pacífico).`,
    doneNext: "¿Quieres avanzar más rápido? Crea tu cuenta de chofer y empieza tu aplicación completa.",
    register: "Crear mi cuenta",
    home: "Volver al inicio",
  },
} as const;

export function DriverApplyForm({ locale, paths }: { locale: Locale; paths: { register: string; home: string; privacy: string; sms: string } }) {
  const L = t[locale];
  const getAttr = useAttribution();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<State>({ endorsements: [], run_types: [], sms_consent: false, locale });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string>();
  const [done, setDone] = useState(false);
  const [hp, setHp] = useState("");
  const [pending, start] = useTransition();
  const set = <K extends keyof State>(k: K, v: State[K]) => {
    setData((d) => ({ ...d, [k]: v }));
    setErrors((e) => ({ ...e, [k as string]: "" }));
  };

  const yn = [
    { value: "yes", label: L.yes },
    { value: "no", label: L.no },
  ] as const;

  const requiredByStep: (keyof State)[][] = [
    ["first_name", "last_name", "phone"],
    ["driver_type"],
    ["has_cdl_a", "experience"],
    ["moving_violations", "accidents", "dui", "drug_test_issue", "work_authorized", "over_21"],
    [],
  ];

  const validate = (s: number) => {
    const missing: Record<string, string> = {};
    for (const k of requiredByStep[s]) if (!data[k]) missing[k as string] = L.required;
    if (s === 0 && data.phone && !/^\+?1?\d{10}$/.test(data.phone.replace(/[^\d+]/g, ""))) missing.phone = locale === "es" ? "Número de EE. UU. válido" : "Enter a valid US phone number";
    if (s === 0 && data.zip && !/^\d{5}$/.test(data.zip)) missing.zip = "5-digit ZIP";
    setErrors(missing);
    return Object.keys(missing).length === 0;
  };

  const next = () => validate(step) && setStep((s) => Math.min(s + 1, 4));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const softFlag =
    data.has_cdl_a === "no" ||
    data.experience === "lt1" ||
    data.moving_violations === "4plus" ||
    data.dui === "yes" ||
    data.drug_test_issue === "yes" ||
    data.over_21 === "no" ||
    data.work_authorized === "no";

  const submit = () => {
    setServerError(undefined);
    start(async () => {
      const res = await submitDriverLead({ ...(data as DriverLeadInput), company_website: hp, ...getAttr() });
      if (res.ok) {
        setDone(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setServerError(res.error);
        if (res.fieldErrors) {
          setErrors(res.fieldErrors);
          const firstStep = requiredByStep.findIndex((keys) => keys.some((k) => res.fieldErrors?.[k as string]));
          if (firstStep >= 0) setStep(firstStep);
        }
      }
    });
  };

  if (done) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="border border-white/15 bg-navy p-8 md:p-12">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-signal">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
            <path d="M5 12.5l4.5 4.5L19 7.5" stroke="white" strokeWidth="2" />
          </svg>
        </span>
        <h2 className="h2 mt-8">{L.doneTitle}</h2>
        <p className="body-lg mt-4 max-w-xl text-white/70">{L.doneSub(data.first_name ?? "")}</p>
        <p className="mt-8 max-w-xl text-white/60">{L.doneNext}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`${paths.register}?email=${encodeURIComponent(data.email ?? "")}`} className="inline-flex h-12 items-center gap-2 rounded bg-signal px-6 font-medium">
            {L.register} <Arrow />
          </Link>
          <Link href={paths.home} className="inline-flex h-12 items-center rounded border border-white/20 px-6">
            {L.home}
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="relative">
      <Honeypot value={hp} onChange={setHp} />
      {/* progress */}
      <ol className="mb-10 grid grid-cols-5 gap-2" aria-label="Progress">
        {L.steps.map((s, i) => (
          <li key={s} className="flex flex-col gap-2">
            <span className={clsx("h-[3px] w-full transition-colors duration-500", i <= step ? "bg-signal" : "bg-white/15")} />
            <span className={clsx("label hidden sm:block", i === step ? "text-white" : "text-white/40")}>
              0{i + 1} {s}
            </span>
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-8"
        >
          {step === 0 && (
            <>
              <div className="grid gap-6 sm:grid-cols-2">
                <TextField label={L.first} name="first_name" autoComplete="given-name" value={data.first_name ?? ""} onChange={(e) => set("first_name", e.target.value)} error={errors.first_name} />
                <TextField label={L.last} name="last_name" autoComplete="family-name" value={data.last_name ?? ""} onChange={(e) => set("last_name", e.target.value)} error={errors.last_name} />
              </div>
              <TextField label={L.phone} name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(702) 555-0123" value={data.phone ?? ""} onChange={(e) => set("phone", e.target.value)} error={errors.phone} />
              <div className="grid gap-6 sm:grid-cols-2">
                <TextField label={L.email} hint={L.optional} name="email" type="email" autoComplete="email" value={data.email ?? ""} onChange={(e) => set("email", e.target.value)} error={errors.email} />
                <TextField label={L.zip} hint={L.optional} name="zip" inputMode="numeric" autoComplete="postal-code" maxLength={5} value={data.zip ?? ""} onChange={(e) => set("zip", e.target.value.replace(/\D/g, ""))} error={errors.zip} />
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <Chips legend={L.driverType} columns={3} value={data.driver_type} onChange={(v) => set("driver_type", v as State["driver_type"])} error={errors.driver_type}
                options={[{ value: "solo", label: L.solo }, { value: "team", label: L.team }, { value: "either", label: L.either }]} />
              <Chips legend={L.runs} multiple columns={3} value={data.run_types} onChange={(v) => set("run_types", v as State["run_types"])}
                options={[{ value: "otr", label: L.otr }, { value: "regional", label: L.regional }, { value: "dedicated", label: L.dedicated }]} />
              {(data.driver_type === "team" || data.driver_type === "either") && (
                <Chips legend={L.partner} value={data.has_team_partner} onChange={(v) => set("has_team_partner", v as "yes" | "no")} options={yn} />
              )}
            </>
          )}

          {step === 2 && (
            <>
              <Chips legend={L.cdl} value={data.has_cdl_a} onChange={(v) => set("has_cdl_a", v as "yes" | "no")} options={yn} error={errors.has_cdl_a} />
              <Chips legend={L.exp} columns={4} value={data.experience} onChange={(v) => set("experience", v as State["experience"])} error={errors.experience}
                options={[{ value: "lt1", label: "< 1 yr" }, { value: "1-2", label: "1–2 yrs" }, { value: "3-5", label: "3–5 yrs" }, { value: "5plus", label: "5+ yrs" }]} />
              <Chips legend={L.endorse} multiple columns={5} value={data.endorsements} onChange={(v) => set("endorsements", v as State["endorsements"])}
                options={[{ value: "hazmat", label: "Hazmat" }, { value: "tanker", label: "Tanker" }, { value: "doubles", label: "Doubles" }, { value: "twic", label: "TWIC" }, { value: "none", label: L.none }]} />
            </>
          )}

          {step === 3 && (
            <>
              <Chips legend={L.violations} columns={5} value={data.moving_violations} onChange={(v) => set("moving_violations", v as State["moving_violations"])} error={errors.moving_violations}
                options={[{ value: "0", label: "0" }, { value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4plus", label: "4+" }]} />
              <Chips legend={L.accidents} columns={3} value={data.accidents} onChange={(v) => set("accidents", v as State["accidents"])} error={errors.accidents}
                options={[{ value: "0", label: "0" }, { value: "1", label: "1" }, { value: "2plus", label: "2+" }]} />
              <div className="grid gap-8 sm:grid-cols-2">
                <Chips legend={L.dui} value={data.dui} onChange={(v) => set("dui", v as "yes" | "no")} options={yn} error={errors.dui} />
                <Chips legend={L.age} value={data.over_21} onChange={(v) => set("over_21", v as "yes" | "no")} options={yn} error={errors.over_21} />
              </div>
              <Chips legend={L.drug} value={data.drug_test_issue} onChange={(v) => set("drug_test_issue", v as "yes" | "no")} options={yn} error={errors.drug_test_issue} />
              <Chips legend={L.auth} value={data.work_authorized} onChange={(v) => set("work_authorized", v as "yes" | "no")} options={yn} error={errors.work_authorized} />
            </>
          )}

          {step === 4 && (
            <>
              <div>
                <h2 className="h3">{L.reviewTitle}</h2>
                <p className="mt-2 text-white/60">
                  {L.reviewSub} <span className="text-white">{company.phone.display}</span>.
                </p>
              </div>
              {softFlag && <p className="rounded border border-dusk/40 bg-dusk/10 p-4 text-sm text-white/80">{L.softNote}</p>}
              <Checkbox checked={!!data.sms_consent} onChange={(v) => set("sms_consent", v)}>
                {L.consent}
              </Checkbox>
              <p className="text-sm text-white/45">
                {L.terms}{" "}
                <Link href={paths.privacy} className="underline underline-offset-2 hover:text-white">
                  {L.privacy}
                </Link>{" "}
                &{" "}
                <Link href={paths.sms} className="underline underline-offset-2 hover:text-white">
                  {L.smsTerms}
                </Link>
                .
              </p>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <ErrorText>{serverError}</ErrorText>

      <div className="mt-10 flex items-center justify-between gap-3 border-t border-white/10 pt-6">
        <button type="button" onClick={back} className={clsx("h-12 px-2 text-white/70 hover:text-white", step === 0 && "invisible")}>
          ← {L.back}
        </button>
        {step < 4 ? (
          <button type="button" onClick={next} className="inline-flex h-14 items-center gap-2 rounded bg-signal px-8 font-medium transition-colors hover:bg-signal-ink">
            {L.next} <Arrow />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="inline-flex h-14 items-center gap-2 rounded bg-signal px-8 font-medium transition-colors hover:bg-signal-ink disabled:opacity-60"
          >
            {pending ? L.sending : L.submit} {!pending && <Arrow />}
          </button>
        )}
      </div>
    </div>
  );
}
