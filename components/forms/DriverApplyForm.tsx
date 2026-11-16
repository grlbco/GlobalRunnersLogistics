"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { trackFormStep } from "@/app/actions/forms";
import { AnimatePresence, motion } from "motion/react";
import { clsx } from "clsx";
import { submitDriverLead } from "@/app/actions/leads";
import { SMS_CONSENT_TEXT, US_PHONE, type DriverLeadInput } from "@/lib/forms";
import { Checkbox, Chips, ErrorText, Honeypot, TextField, useAttribution } from "./fields";
import { Arrow } from "@/components/ui/Button";
import { company } from "@/content/facts";
import { CallMeNow } from "./CallMeNow";
import type { Locale } from "@/lib/i18n";

type StepId = "you" | "job" | "exp" | "rec" | "rec1" | "rec2" | "send";
type State = Partial<DriverLeadInput> & { endorsements: NonNullable<DriverLeadInput["endorsements"]>; run_types: NonNullable<DriverLeadInput["run_types"]> };

const t = {
  en: {
    steps: ["You", "The job", "Experience", "Record", "Send"],
    hi: (n: string) => (n ? `Hi ${n},` : "Hi,"),
    confirmQ: "Is this the best number to reach you?",
    yesMine: "Yes, that's my number",
    different: "Use a different number",
    notYou: (n: string) => `Not ${n}?`,
    change: "Change",
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
    doneSub: (name: string) => `Thanks, ${name}. Our team will call you from ${company.phone.vanity} (${company.phone.display}) — usually within the hour during office hours (Central Time).`,
    doneNext: "Want to speed things up? Create your driver account and start your full application.",
    doneNothing: "That's it. There's nothing else you need to do.",
    stepOf: (a: number, b: number) => `Step ${a} of ${b}`,
    register: "Create my account",
    home: "Back to home",
  },
  es: {
    steps: ["Tú", "El trabajo", "Experiencia", "Historial", "Enviar"],
    hi: (n: string) => (n ? `Hola ${n},` : "Hola,"),
    confirmQ: "¿Este es el mejor número para contactarte?",
    yesMine: "Sí, es mi número",
    different: "Usar otro número",
    notYou: (n: string) => `¿No eres ${n}?`,
    change: "Cambiar",
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
    doneSub: (name: string) => `Gracias, ${name}. Nuestro equipo te llamará desde el ${company.phone.vanity} (${company.phone.display}), normalmente en menos de una hora en horario de oficina (hora del Centro).`,
    doneNext: "¿Quieres avanzar más rápido? Crea tu cuenta de chofer y empieza tu aplicación completa.",
    doneNothing: "Eso es todo. No tienes que hacer nada más.",
    stepOf: (a: number, b: number) => `Paso ${a} de ${b}`,
    register: "Crear mi cuenta",
    home: "Volver al inicio",
  },
} as const;

export function DriverApplyForm({
  locale,
  paths,
  token,
  prefill,
  compact = false,
}: {
  locale: Locale;
  paths: { register: string; home: string; privacy: string; sms: string };
  token?: string;
  prefill?: { first_name?: string; last_name?: string; phone?: string; email?: string } | null;
  /** Personal short link (/a/<code>): full-screen, every step fits the screen, no site chrome. */
  compact?: boolean;
}) {
  const L = t[locale];
  // compact splits the 6 record questions over two screens so each one fits a phone without scrolling
  const ids = (compact ? ["you", "job", "exp", "rec1", "rec2", "send"] : ["you", "job", "exp", "rec", "send"]) as StepId[];
  const last = ids.length - 1;
  const stepLabels = compact ? [L.steps[0], L.steps[1], L.steps[2], L.steps[3], L.steps[3], L.steps[4]] : [...L.steps];
  const getAttr = useAttribution();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<State>({ endorsements: [], run_types: [], sms_consent: false, locale, ...(prefill ?? {}) });
  // Personal link: tell the CRM how far the driver got (opened → step n).
  useEffect(() => {
    if (token) trackFormStep(token, step);
  }, [token, step]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Personal link with a known phone: one-tap confirm instead of typing.
  const [editing, setEditing] = useState(!prefill?.phone);
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

  const requiredById: Record<StepId, (keyof State)[]> = {
    you: ["first_name", "last_name", "phone"],
    job: ["driver_type"],
    exp: ["has_cdl_a", "experience"],
    rec: ["moving_violations", "accidents", "dui", "drug_test_issue", "work_authorized", "over_21"],
    rec1: ["moving_violations", "accidents", "dui"],
    rec2: ["over_21", "drug_test_issue", "work_authorized"],
    send: [],
  };
  const requiredByStep = ids.map((id) => requiredById[id]);
  const id = ids[step];

  const validate = (s: number) => {
    const missing: Record<string, string> = {};
    for (const k of requiredByStep[s]) if (!data[k]) missing[k as string] = L.required;
    if (s === 0 && data.phone && !US_PHONE.test(data.phone.replace(/[^\d+]/g, ""))) missing.phone = locale === "es" ? "Número de EE. UU. válido" : "Enter a valid US phone number";
    if (s === 0 && data.zip && !/^\d{5}$/.test(data.zip)) missing.zip = "5-digit ZIP";
    setErrors(missing);
    return Object.keys(missing).length === 0;
  };

  const next = () => validate(step) && setStep((s) => Math.min(s + 1, last));
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
      const res = await submitDriverLead({ ...(data as DriverLeadInput), ...(token ? { t: token } : {}), company_website: hp, ...getAttr() });
      if (res.ok) {
        setDone(true);
        if (!compact) window.scrollTo({ top: 0, behavior: "smooth" });
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

  if (done && compact) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex h-full flex-col items-center justify-center text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-signal">
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none">
            <path d="M5 12.5l4.5 4.5L19 7.5" stroke="white" strokeWidth="2" />
          </svg>
        </span>
        <h2 className="mt-6 text-[1.75rem] font-semibold tracking-[-0.02em]">{L.doneTitle}</h2>
        <p className="mt-3 max-w-sm text-white/70">{L.doneSub(data.first_name ?? "")}</p>
        <p className="mt-6 max-w-sm text-sm text-white/50">{L.doneNothing}</p>
        <div className="mt-6 w-full max-w-sm"><CallMeNow token={token ?? null} phone={data.phone ?? null} name={[data.first_name, data.last_name].filter(Boolean).join(" ")} source="application" locale={locale === "es" ? "es" : "en"} /></div>
      </motion.div>
    );
  }

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
        <div className="mt-6 max-w-xl"><CallMeNow token={token ?? null} phone={data.phone ?? null} name={[data.first_name, data.last_name].filter(Boolean).join(" ")} source="application" locale={locale === "es" ? "es" : "en"} /></div>
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
    <div className={clsx("relative", compact && "flex h-full flex-col")}>
      <Honeypot value={hp} onChange={setHp} />
      {/* progress */}
      {compact ? (
        <div className="shrink-0">
          <div className="flex gap-1.5" aria-hidden>
            {ids.map((x, i) => (
              <span key={x} className={clsx("h-[3px] flex-1 rounded-full transition-colors duration-500", i <= step ? "bg-signal" : "bg-white/15")} />
            ))}
          </div>
          <p className="label mt-2 text-white/50" aria-live="polite">{L.stepOf(step + 1, ids.length)} · {stepLabels[step]}</p>
        </div>
      ) : (
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
      )}

      <div className={clsx(compact && "flex min-h-0 flex-1 flex-col justify-center overflow-y-auto py-4")}>
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className={compact ? "space-y-5" : "space-y-8"}
        >
          {id === "you" && !editing && (
            <div className="space-y-6">
              <div>
                <p className="h3">{L.hi(data.first_name ?? "")}</p>
                <p className="body-lg mt-2 text-white/70">{L.confirmQ}</p>
              </div>
              <p className="rounded-[6px] border border-white/15 bg-white/[0.03] px-5 py-4 text-center text-[1.75rem] font-semibold tracking-[-0.02em] tabular-nums sm:text-[2rem]">{data.phone}</p>
              <div className="grid gap-3">
                <button type="button" onClick={() => (validate(0) ? setStep(1) : setEditing(true))} className="flex h-14 items-center justify-center gap-2 rounded-[4px] bg-signal text-base font-medium text-white transition-colors hover:bg-signal-ink">
                  {L.yesMine} <Arrow />
                </button>
                <button type="button" onClick={() => { setEditing(true); set("phone", ""); }} className="h-14 rounded-[4px] border border-white/20 text-base text-white/85 transition-colors hover:border-white">
                  {L.different}
                </button>
              </div>
              {data.first_name && (
                <p className="text-center text-sm text-white/50">
                  {L.notYou(data.first_name)}{" "}
                  <button type="button" onClick={() => setEditing(true)} className="text-white underline underline-offset-4">{L.change}</button>
                </p>
              )}
            </div>
          )}
          {id === "you" && editing && (
            <>
              <div className={clsx("grid sm:grid-cols-2", compact ? "grid-cols-2 gap-3" : "gap-6")}>
                <TextField label={L.first} name="first_name" autoComplete="given-name" value={data.first_name ?? ""} onChange={(e) => set("first_name", e.target.value)} error={errors.first_name} />
                <TextField label={L.last} name="last_name" autoComplete="family-name" value={data.last_name ?? ""} onChange={(e) => set("last_name", e.target.value)} error={errors.last_name} />
              </div>
              <TextField label={L.phone} name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(702) 555-0123" value={data.phone ?? ""} onChange={(e) => set("phone", e.target.value)} error={errors.phone} />
              {!prefill && (
                <div className="grid gap-6 sm:grid-cols-2">
                  <TextField label={L.email} hint={L.optional} name="email" type="email" autoComplete="email" value={data.email ?? ""} onChange={(e) => set("email", e.target.value)} error={errors.email} />
                  <TextField label={L.zip} hint={L.optional} name="zip" inputMode="numeric" autoComplete="postal-code" maxLength={5} value={data.zip ?? ""} onChange={(e) => set("zip", e.target.value.replace(/\D/g, ""))} error={errors.zip} />
                </div>
              )}
            </>
          )}

          {id === "job" && (
            <>
              <Chips dense={compact} legend={L.driverType} columns={3} value={data.driver_type} onChange={(v) => set("driver_type", v as State["driver_type"])} error={errors.driver_type}
                options={[{ value: "solo", label: L.solo }, { value: "team", label: L.team }, { value: "either", label: L.either }]} />
              <Chips dense={compact} legend={L.runs} multiple columns={3} value={data.run_types} onChange={(v) => set("run_types", v as State["run_types"])}
                options={[{ value: "otr", label: L.otr }, { value: "regional", label: L.regional }, { value: "dedicated", label: L.dedicated }]} />
              {(data.driver_type === "team" || data.driver_type === "either") && (
                <Chips dense={compact} legend={L.partner} value={data.has_team_partner} onChange={(v) => set("has_team_partner", v as "yes" | "no")} options={yn} />
              )}
            </>
          )}

          {id === "exp" && (
            <>
              <Chips dense={compact} legend={L.cdl} value={data.has_cdl_a} onChange={(v) => set("has_cdl_a", v as "yes" | "no")} options={yn} error={errors.has_cdl_a} />
              <Chips dense={compact} legend={L.exp} columns={4} value={data.experience} onChange={(v) => set("experience", v as State["experience"])} error={errors.experience}
                options={[{ value: "lt1", label: "< 1 yr" }, { value: "1-2", label: "1–2 yrs" }, { value: "3-5", label: "3–5 yrs" }, { value: "5plus", label: "5+ yrs" }]} />
              <Chips dense={compact} legend={L.endorse} multiple columns={compact ? 3 : 5} value={data.endorsements} onChange={(v) => set("endorsements", v as State["endorsements"])}
                options={[{ value: "hazmat", label: "Hazmat" }, { value: "tanker", label: "Tanker" }, { value: "doubles", label: "Doubles" }, { value: "twic", label: "TWIC" }, { value: "none", label: L.none }]} />
            </>
          )}

          {(id === "rec" || id === "rec1") && (
            <>
              <Chips dense={compact} legend={L.violations} columns={5} value={data.moving_violations} onChange={(v) => set("moving_violations", v as State["moving_violations"])} error={errors.moving_violations}
                options={[{ value: "0", label: "0" }, { value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4plus", label: "4+" }]} />
              <Chips dense={compact} legend={L.accidents} columns={3} value={data.accidents} onChange={(v) => set("accidents", v as State["accidents"])} error={errors.accidents}
                options={[{ value: "0", label: "0" }, { value: "1", label: "1" }, { value: "2plus", label: "2+" }]} />
              {id === "rec" ? (
                <>
                  <div className="grid gap-8 sm:grid-cols-2">
                    <Chips legend={L.dui} value={data.dui} onChange={(v) => set("dui", v as "yes" | "no")} options={yn} error={errors.dui} />
                    <Chips legend={L.age} value={data.over_21} onChange={(v) => set("over_21", v as "yes" | "no")} options={yn} error={errors.over_21} />
                  </div>
                  <Chips legend={L.drug} value={data.drug_test_issue} onChange={(v) => set("drug_test_issue", v as "yes" | "no")} options={yn} error={errors.drug_test_issue} />
                  <Chips legend={L.auth} value={data.work_authorized} onChange={(v) => set("work_authorized", v as "yes" | "no")} options={yn} error={errors.work_authorized} />
                </>
              ) : (
                <Chips dense legend={L.dui} value={data.dui} onChange={(v) => set("dui", v as "yes" | "no")} options={yn} error={errors.dui} />
              )}
            </>
          )}

          {id === "rec2" && (
            <>
              <Chips dense legend={L.age} value={data.over_21} onChange={(v) => set("over_21", v as "yes" | "no")} options={yn} error={errors.over_21} />
              <Chips dense legend={L.drug} value={data.drug_test_issue} onChange={(v) => set("drug_test_issue", v as "yes" | "no")} options={yn} error={errors.drug_test_issue} />
              <Chips dense legend={L.auth} value={data.work_authorized} onChange={(v) => set("work_authorized", v as "yes" | "no")} options={yn} error={errors.work_authorized} />
            </>
          )}

          {id === "send" && (
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
      </div>

      <ErrorText>{serverError}</ErrorText>

      <div className={clsx("flex shrink-0 items-center justify-between gap-3 border-t border-white/10", compact ? "pt-4" : "mt-10 pt-6", id === "you" && !editing && "hidden")}>
        <button type="button" onClick={back} className={clsx("h-12 px-2 text-white/70 hover:text-white", step === 0 && "hidden")}>
          ← {L.back}
        </button>
        {step < last ? (
          <button type="button" onClick={next} className="inline-flex h-14 flex-1 items-center justify-center gap-2 rounded bg-signal px-8 font-medium transition-colors hover:bg-signal-ink sm:flex-none">
            {L.next} <Arrow />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="inline-flex h-14 flex-1 items-center justify-center gap-2 rounded bg-signal px-8 font-medium transition-colors hover:bg-signal-ink disabled:opacity-60 sm:flex-none"
          >
            {pending ? L.sending : L.submit} {!pending && <Arrow />}
          </button>
        )}
      </div>
    </div>
  );
}
