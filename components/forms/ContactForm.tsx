"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { submitContact } from "@/app/actions/leads";
import { SMS_CONSENT_TEXT, type ContactInput } from "@/lib/forms";
import { Checkbox, Chips, ErrorText, Honeypot, TextArea, TextField } from "./fields";
import { Arrow } from "@/components/ui/Button";
import type { Locale } from "@/lib/i18n";

export function ContactForm({ locale, paths }: { locale: Locale; paths: { privacy: string; sms: string } }) {
  const [d, setD] = useState<Partial<ContactInput>>({ locale, sms_consent: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string>();
  const [hp, setHp] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const set = <K extends keyof ContactInput>(k: K, v: ContactInput[K]) => {
    setD((p) => ({ ...p, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  if (done)
    return (
      <div className="border border-white/15 bg-navy p-8">
        <h2 className="h3">Message sent.</h2>
        <p className="mt-3 text-white/70">Thanks — we&apos;ll get back to you soon.</p>
      </div>
    );

  return (
    <form
      noValidate
      className="relative space-y-7"
      onSubmit={(e) => {
        e.preventDefault();
        setServerError(undefined);
        start(async () => {
          const res = await submitContact({ ...(d as ContactInput), company_website: hp });
          if (res.ok) setDone(true);
          else {
            setServerError(res.error);
            setErrors(res.fieldErrors ?? {});
          }
        });
      }}
    >
      <Honeypot value={hp} onChange={setHp} />
      <Chips legend="What's this about?" columns={4} value={d.topic} onChange={(v) => set("topic", v as ContactInput["topic"])} error={errors.topic}
        options={[{ value: "driving", label: "Driving job" }, { value: "owner_operator", label: "Owner-operator" }, { value: "shipper", label: "Shipper" }, { value: "other", label: "Other" }]} />
      <TextField label="Name" name="name" autoComplete="name" value={d.name ?? ""} onChange={(e) => set("name", e.target.value)} error={errors.name} />
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField label="Email" name="email" type="email" autoComplete="email" value={d.email ?? ""} onChange={(e) => set("email", e.target.value)} error={errors.email} />
        <TextField label="Phone" name="phone" type="tel" autoComplete="tel" value={d.phone ?? ""} onChange={(e) => set("phone", e.target.value)} error={errors.phone} />
      </div>
      <TextArea label="Message" name="message" value={d.message ?? ""} onChange={(e) => set("message", e.target.value)} error={errors.message} />
      {d.phone && (
        <Checkbox checked={!!d.sms_consent} onChange={(v) => set("sms_consent", v)}>
          {SMS_CONSENT_TEXT[locale]}
        </Checkbox>
      )}
      <p className="text-sm text-white/45">
        By submitting you agree to our <Link href={paths.privacy} className="underline underline-offset-2">Privacy Policy</Link> &{" "}
        <Link href={paths.sms} className="underline underline-offset-2">SMS Terms</Link>.
      </p>
      <ErrorText>{serverError}</ErrorText>
      <button type="submit" disabled={pending} className="inline-flex h-14 items-center gap-2 rounded bg-signal px-8 font-medium hover:bg-signal-ink disabled:opacity-60">
        {pending ? "Sending…" : "Send message"} {!pending && <Arrow />}
      </button>
    </form>
  );
}
