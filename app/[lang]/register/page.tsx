import { Suspense } from "react";
import { resolveLocale, localePath } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";
import { routes } from "@/content/navigation";
import { AuthShell } from "@/components/layout/AuthShell";
import { RegisterForm } from "@/components/forms/AuthForms";

export async function generateMetadata({ params }: PageProps<"/[lang]/register">) {
  const lang = await resolveLocale(params);
  return pageMeta(lang, "/register", "Create account", "Global Runners Logistics driver portal.", { noindex: true });
}

export default async function Page({ params }: PageProps<"/[lang]/register">) {
  const lang = await resolveLocale(params);
  const p = (path: string) => localePath(lang, path);
  void routes;
  void p;
  return (
    <AuthShell label="Driver portal" title="Create your account." intro="Finish your full application online, upload documents and track your status — all in one place.">
      <Suspense fallback={<div className="h-80" />}>
        <RegisterForm locale={lang} paths={{ login: p("/login"), terms: p(routes.terms), privacy: p(routes.privacy) }} />
      </Suspense>
    </AuthShell>
  );
}
