import Link from "next/link";
import { AuthShell, ForgotForm } from "@/components/crm/AuthPanels";

export const metadata = { title: "Reset password" };

export default function ForgotPage() {
  return (
    <AuthShell
      title="Reset your password"
      sub="Enter the email you sign in with. We'll send a link to choose a new password."
      footer={<Link href="/crm/login" className="underline-offset-4 hover:text-white hover:underline">Back to sign in</Link>}
    >
      <ForgotForm />
    </AuthShell>
  );
}
