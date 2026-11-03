import { Suspense } from "react";
import { resolveLocale, localePath } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";
import { routes } from "@/content/navigation";
import { AuthShell } from "@/components/layout/AuthShell";
import { ResetForm } from "@/components/forms/AuthForms";

export async function generateMetadata({ params }: PageProps<"/[lang]/reset-password">) {
  const lang = await resolveLocale(params);
  return pageMeta(lang, "/reset-password", "Reset password", "Global Runners Logistics driver portal.", { noindex: true });
}

export default async function Page({ params }: PageProps<"/[lang]/reset-password">) {
  const lang = await resolveLocale(params);
  const p = (path: string) => localePath(lang, path);
  void routes;
  void p;
  return (
    <AuthShell label="Driver portal" title="Reset password." intro="We'll email you a secure link.">
      <Suspense fallback={<div className="h-80" />}>
        <ResetForm locale={lang}  />
      </Suspense>
    </AuthShell>
  );
}
