export const locales = ["en", "es"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export const hasLocale = (value: string): value is Locale =>
  (locales as readonly string[]).includes(value);

/** Build a path for a locale. English has no prefix: "/drive", Spanish: "/es/drive". */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (locale === defaultLocale) return clean;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}

/** Strip a locale prefix from a pathname: "/es/drive" -> "/drive". */
export function stripLocale(pathname: string): string {
  const parts = pathname.split("/");
  if (parts[1] && hasLocale(parts[1])) {
    const rest = "/" + parts.slice(2).join("/");
    return rest === "/" ? "/" : rest.replace(/\/$/, "");
  }
  return pathname || "/";
}

export function localeFromPathname(pathname: string): Locale {
  const seg = pathname.split("/")[1];
  return seg && hasLocale(seg) ? seg : defaultLocale;
}
