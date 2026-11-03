import { Suspense } from "react";
import { resolveLocale, localePath } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";
import { routes } from "@/content/navigation";
import { AuthShell } from "@/components/layout/AuthShell";
import { LoginForm } from "@/components/forms/AuthForms";

export async function generateMetadata({ params }: PageProps<"/[lang]/login">) {
  const lang = await resolveLocale(params);
  return pageMeta(lang, "/login", "Log in", "Global Runners Logistics driver portal.", { noindex: true });
}

export default async function Page({ params }: PageProps<"/[lang]/login">) {
  const lang = await resolveLocale(params);
  const p = (path: string) => localePath(lang, path);
  void routes;
  void p;
  return (
    <AuthShell label="Driver portal" title="Welcome back." intro="Log in to check your application and finish your paperwork.">
      <Suspense fallback={<div className="h-80" />}>
        <LoginForm locale={lang} paths={{ register: p("/register"), reset: p("/reset-password") }} />
      </Suspense>
    </AuthShell>
  );
}
