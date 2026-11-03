import type { Metadata } from "next";
import { company } from "@/content/facts";
import type { Locale } from "./i18n";
import { localePath } from "./i18n";

/**
 * Per-page metadata. Spanish versions of pages whose body copy isn't translated yet are
 * noindex + canonical to English so search engines never see duplicate content (docs/plan/06).
 */
export function pageMeta(
  lang: Locale,
  path: string,
  title: string,
  description: string,
  opts: { translated?: boolean; noindex?: boolean } = {},
): Metadata {
  const translated = opts.translated ?? false;
  const enUrl = localePath("en", path);
  const esUrl = localePath("es", path);
  const canonical = lang === "es" && !translated ? enUrl : localePath(lang, path);
  const noindex = opts.noindex || (lang === "es" && !translated);
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: translated ? { en: enUrl, es: esUrl, "x-default": enUrl } : undefined,
    },
    openGraph: { title, description, url: `${company.url}${canonical}`, type: "website", siteName: company.shortName },
    twitter: { card: "summary_large_image", title, description },
    ...(noindex || process.env.NEXT_PUBLIC_ALLOW_INDEXING !== "true" ? { robots: { index: false, follow: !noindex } } : {}),
  };
}
