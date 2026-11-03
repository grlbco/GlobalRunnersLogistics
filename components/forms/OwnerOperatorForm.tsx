"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { submitOwnerLead } from "@/app/actions/leads";
import { SMS_CONSENT_TEXT, type OwnerLeadInput } from "@/lib/forms";
import { Checkbox, Chips, ErrorText, Honeypot, TextArea, TextField, useAttribution } from "./fields";
import { Arrow } from "@/components/ui/Button";
import { company } from "@/content/facts";
import type { Locale } from "@/lib/i18n";

export function OwnerOperatorForm({ locale, paths }: { locale: Locale; paths: { privacy: string; sms: string } }) {
  const getAttr = useAttribution();
  const [d, setD] = useState<Partial<OwnerLeadInput>>({ locale, sms_consent: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string>();
  const [hp, setHp] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const set = <K extends keyof OwnerLeadInput>(k: K, v: OwnerLeadInput[K]) => {
    setD((p) => ({ ...p, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  if (done)
    return (
      <div className="border border-white/15 bg-navy p-8 md:p-12">
        <h2 className="h2">Thanks — we got it.</h2>
        <p className="body-lg mt-4 max-w-xl text-white/70">
          We&apos;ll call you from {company.phone.display} to walk you through the owner-operator program.
        </p>
      </div>
    );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(undefined);
    start(async () => {
      const res = await submitOwnerLead({ ...(d as OwnerLeadInput), company_website: hp, ...getAttr() });
      if (res.ok) setDone(true);
      else {
        setServerError(res.error);
        setErrors(res.fieldErrors ?? {});
      }
    });
  };

  return (
    <form onSubmit={submit} className="relative space-y-8" noValidate>
      <Honeypot value={hp} onChange={setHp} />
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField label="First name" name="first_name" autoComplete="given-name" value={d.first_name ?? ""} onChange={(e) => set("first_name", e.target.value)} error={errors.first_name} />
        <TextField label="Last name" name="last_name" autoComplete="family-name" value={d.last_name ?? ""} onChange={(e) => set("last_name", e.target.value)} error={errors.last_name} />
        <TextField label="Mobile phone" name="phone" type="tel" autoComplete="tel" value={d.phone ?? ""} onChange={(e) => set("phone", e.target.value)} error={errors.phone} />
        <TextField label="Email" hint="Optional" name="email" type="email" autoComplete="email" value={d.email ?? ""} onChange={(e) => set("email", e.target.value)} error={errors.email} />
      </div>
      <div className="grid gap-6 sm:grid-cols-3">
        <TextField label="Truck year" name="truck_year" inputMode="numeric" maxLength={4} value={(d.truck_year as string | undefined) ?? ""} onChange={(e) => set("truck_year", e.target.value.replace(/\D/g, "") as unknown as number)} error={errors.truck_year} />
        <TextField label="Make" name="truck_make" placeholder="Peterbilt" value={d.truck_make ?? ""} onChange={(e) => set("truck_make", e.target.value)} />
        <TextField label="Model" name="truck_model" placeholder="579" value={d.truck_model ?? ""} onChange={(e) => set("truck_model", e.target.value)} />
      </div>
      <Chips legend="Trailer" columns={3} value={d.trailer} onChange={(v) => set("trailer", v as OwnerLeadInput["trailer"])}
        options={[{ value: "none", label: "No trailer" }, { value: "own_dry_van", label: "Own 53' dry van" }, { value: "other", label: "Other" }]} />
      <div className="grid gap-8 sm:grid-cols-2">
        <Chips legend="Do you have your own authority?" value={d.own_authority} onChange={(v) => set("own_authority", v as "yes" | "no")}
          options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
        <Chips legend="Years as an owner-operator" columns={4} value={d.years_owner_operator} onChange={(v) => set("years_owner_operator", v as OwnerLeadInput["years_owner_operator"])}
          options={[{ value: "lt1", label: "< 1" }, { value: "1-2", label: "1–2" }, { value: "3-5", label: "3–5" }, { value: "5plus", label: "5+" }]} />
      </div>
      <TextField label="Home base (city, state)" name="home_base" value={d.home_base ?? ""} onChange={(e) => set("home_base", e.target.value)} />
      <TextArea label="Anything else we should know?" name="notes" value={d.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
      <Checkbox checked={!!d.sms_consent} onChange={(v) => set("sms_consent", v)}>
        {SMS_CONSENT_TEXT[locale]}
      </Checkbox>
      <p className="text-sm text-white/45">
        By submitting you agree to our{" "}
        <Link href={paths.privacy} className="underline underline-offset-2">Privacy Policy</Link> &{" "}
        <Link href={paths.sms} className="underline underline-offset-2">SMS Terms</Link>.
      </p>
      <ErrorText>{serverError}</ErrorText>
      <button type="submit" disabled={pending} className="inline-flex h-14 items-center gap-2 rounded bg-signal px-8 font-medium hover:bg-signal-ink disabled:opacity-60">
        {pending ? "Sending…" : "Send"} {!pending && <Arrow />}
      </button>
    </form>
  );
}
