import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentStaff } from "@/lib/crm/auth";
import { AuthShell, NewPasswordForm } from "@/components/crm/AuthPanels";

export const metadata = { title: "New password" };

export default function ResetPage() {
  return (
    <AuthShell title="Choose a new password" sub="You're signed in from the reset link. Set the password you'll use from now on.">
      <Suspense fallback={<div className="h-64" />}>
        <Body />
      </Suspense>
    </AuthShell>
  );
}

async function Body() {
  const loaded = await currentStaff();
  if (loaded.state === "signed_out") redirect("/crm/login?error=link");
  if (loaded.state === "no_access") redirect(`/crm/no-access?reason=${loaded.reason}`);
  return <NewPasswordForm />;
}
