import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/brand/Logo";
import { DriverApplyForm } from "@/components/forms/DriverApplyForm";
import { linkForCode } from "@/lib/crm/forms";
import { routes } from "@/content/navigation";
import { company } from "@/content/facts";

const paths = {
  register: "/register",
  home: "/",
  privacy: routes.privacy,
  sms: routes.sms,
};

/**
 * Personal form link sent by the CRM: globalrunnerslogistics.com/a/<code>.
 * One full screen on any phone, tablet or desktop: brand bar, the form centered, nothing else.
 */
export default function ShortFormPage({ params }: PageProps<"/a/[code]">) {
  return (
    <div className="flex h-dvh flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-3">
        <Logo className="h-7 md:h-8" priority />
        <a
          href={`tel:${company.phone.e164}`}
          className="text-sm text-white/60 underline-offset-4 hover:text-white hover:underline"
        >
          {company.phone.display}
        </a>
      </header>
      <main className="flex min-h-0 flex-1 justify-center px-5 py-4 md:items-center md:py-8">
        <div className="flex h-full w-full max-w-md flex-col md:h-[640px] md:max-h-full md:rounded-xl md:border md:border-white/10 md:bg-navy/40 md:p-8">
          <Suspense
            fallback={
              <div
                className="m-auto h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-signal"
                aria-label="Loading"
              />
            }
          >
            <Form params={params} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

async function Form({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const link = await linkForCode(code).catch(() => null);
  if (!link) notFound();
  return (
    <>
      {link.completed ? (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <h1 className="text-[1.6rem] font-semibold tracking-[-0.02em]">
            You already applied.
          </h1>
          <p className="mt-3 max-w-sm text-white/70">
            We have your application. Our team will call you from{" "}
            {company.phone.display}. Questions? Call or text that number
            anytime.
          </p>
        </div>
      ) : (
        <DriverApplyForm
          compact
          locale="en"
          paths={paths}
          token={link.token}
          prefill={link.prefill}
        />
      )}
    </>
  );
}
