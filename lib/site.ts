import { company } from "@/content/facts";

/** Public site origin (env override for previews). */
export const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || company.url;
