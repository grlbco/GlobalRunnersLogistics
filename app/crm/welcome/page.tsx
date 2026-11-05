import { Suspense } from "react";
import { requireStaff } from "@/lib/crm/auth";
import { AuthShell, NewPasswordForm } from "@/components/crm/AuthPanels";

export const metadata = { title: "Set your password" };

type SP = Promise<{ next?: string }>;

/** First sign-in with a temporary password (or after an admin reset): a new password is required before anything else. */
export default function WelcomePage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<div className="h-dvh" />}>
      <Body searchParams={searchParams} />
    </Suspense>
  );
}

async function Body({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { staff } = await requireStaff("/crm/welcome");
  return (
    <AuthShell
      title={`Welcome, ${staff.name.split(" ")[0]}`}
      sub={staff.mustChangePassword ? "You signed in with a temporary password. Choose your own before you continue." : "Choose a new password."}
    >
      <NewPasswordForm next={sp.next} submitLabel="Save and continue" />
    </AuthShell>
  );
}
