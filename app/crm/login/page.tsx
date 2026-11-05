import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentStaff } from "@/lib/crm/auth";
import { homeFor, safeNext } from "@/lib/crm/permissions";
import { AuthShell, SignInForm } from "@/components/crm/AuthPanels";

export const metadata = { title: "Sign in" };

type SP = Promise<{ next?: string; error?: string; reset?: string }>;

export default function LoginPage({ searchParams }: { searchParams: SP }) {
  return (
    <AuthShell title="Sign in" sub="The Global Runners recruiting CRM. Staff only.">
      <Suspense fallback={<div className="h-64" />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function Form({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const loaded = await currentStaff();
  if (loaded.state === "ok") {
    const wanted = safeNext(sp.next, "");
    redirect(wanted && wanted !== "/crm" ? wanted : homeFor(loaded.staff.perms));
  }
  const notice = sp.error === "link" ? "That link expired or was already used. Request a new one." : undefined;
  return <SignInForm next={sp.next} notice={notice} />;
}
