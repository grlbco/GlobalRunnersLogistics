import Link from "next/link";

export default function NoAccess() {
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-sm text-center">
        <h1 className="text-2xl font-semibold tracking-[-0.03em]">No access</h1>
        <p className="mt-3 text-sm text-white/55">Your account isn&apos;t a staff account. Ask an admin to give you recruiter access.</p>
        <Link href="/" className="mt-6 inline-block text-sm text-white/70 underline underline-offset-4 hover:text-white">Back to the website</Link>
      </div>
    </div>
  );
}
