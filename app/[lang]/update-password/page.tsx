import { Suspense } from "react";
import { resolveLocale, localePath } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";
import { routes } from "@/content/navigation";
import { AuthShell } from "@/components/layout/AuthShell";
import { UpdatePasswordForm } from "@/components/forms/AuthForms";

export async function generateMetadata({ params }: PageProps<"/[lang]/update-password">) {
  const lang = await resolveLocale(params);
  return pageMeta(lang, "/update-password", "Update password", "Global Runners Logistics driver portal.", { noindex: true });
}

export default async function Page({ params }: PageProps<"/[lang]/update-password">) {
  const lang = await resolveLocale(params);
  const p = (path: string) => localePath(lang, path);
  void routes;
  void p;
  return (
    <AuthShell label="Driver portal" title="New password.">
      <Suspense fallback={<div className="h-80" />}>
        <UpdatePasswordForm locale={lang}  />
      </Suspense>
    </AuthShell>
  );
}
