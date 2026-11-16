import { company } from "@/content/facts";

/** Public site origin (env override for previews). */
export const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || company.url;

/**
 * Short personal form link, e.g. "globalrunnerslogistics.com/a/x7Kq2p".
 * No "https://" so it reads clean in a text; phones and mail apps still make it tappable.
 */
export const formUrl = (code: string) => `${siteUrl().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "")}/a/${code}`;
