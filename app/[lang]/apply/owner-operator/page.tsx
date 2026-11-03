import { redirect } from "next/navigation";
import { resolveLocale, localePath } from "@/lib/i18n";
import { routes } from "@/content/navigation";

/** The owner-operator form lives on the Owner-operators page. */
export default async function ApplyOwnerOperator({ params }: PageProps<"/[lang]/apply/owner-operator">) {
  const lang = await resolveLocale(params);
  redirect(`${localePath(lang, routes.ownerOperators)}#apply`);
}
