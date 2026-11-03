import "server-only";
import type { Locale } from "@/lib/i18n";
import type { Dictionary } from "./en";

const loaders: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import("./en").then((m) => m.default),
  es: () => import("./es").then((m) => m.default),
};

export const getDictionary = (locale: Locale) => loaders[locale]();
export type { Dictionary };
