import { localePath, type Locale } from "@/lib/i18n";
import { routes } from "@/content/navigation";
import { company } from "@/content/facts";
import { ButtonLink } from "@/components/ui/Button";

export function CtaBand({ lang, title = "Two minutes to apply." }: { lang: Locale; title?: string }) {
  const p = (path: string) => localePath(lang, path);
  return (
    <section className="bg-signal">
      <div className="container-site flex flex-col gap-8 py-20 md:flex-row md:items-center md:justify-between">
        <p className="display max-w-[14ch]">{title}</p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={p(routes.applyDriver)} arrow className="h-14 bg-white px-8 text-ink hover:text-white">Apply now</ButtonLink>
          <ButtonLink href={`tel:${company.phone.e164}`} variant="outline" className="h-14 border-white/50 px-8">Call {company.phone.display}</ButtonLink>
        </div>
      </div>
    </section>
  );
}
