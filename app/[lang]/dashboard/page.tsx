import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { resolveLocale, localePath, type Locale } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";
import { routes } from "@/content/navigation";
import { company } from "@/content/facts";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";
import { Arrow } from "@/components/ui/Button";

export async function generateMetadata({ params }: PageProps<"/[lang]/dashboard">) {
  const lang = await resolveLocale(params);
  return pageMeta(lang, "/dashboard", "Driver portal", "Your Global Runners Logistics driver portal.", { noindex: true });
}

const statusLabel: Record<string, string> = {
  new: "Received",
  contacted: "Recruiter contacted you",
  qualified: "Qualified — next steps",
  not_qualified: "Not a match right now",
  hired: "Hired",
  archived: "Closed",
};

export default async function DashboardPage({ params }: PageProps<"/[lang]/dashboard">) {
  const lang = await resolveLocale(params);
  return (
    <section className="min-h-svh pb-24 pt-32 md:pt-40">
      <div className="container-site">
        <Suspense fallback={<div className="h-96 animate-pulse rounded bg-white/[0.03]" />}>
          <Portal lang={lang} />
        </Suspense>
      </div>
    </section>
  );
}

async function Portal({ lang }: { lang: Locale }) {
  const p = (path: string) => localePath(lang, path);
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims) redirect(p("/login?next=/dashboard"));

  const [{ data: profile }, { data: leads }] = await Promise.all([
    supabase.from("profiles").select("full_name, role").eq("id", claims.sub).maybeSingle(),
    supabase.from("driver_leads").select("id, created_at, driver_type, status").order("created_at", { ascending: false }).limit(10),
  ]);
  const first = (profile?.full_name ?? (claims.email as string | undefined) ?? "").split(" ")[0];
  const staff = profile?.role === "recruiter" || profile?.role === "admin";

  return (
    <div className="grid gap-12 lg:grid-cols-12">
      <header className="lg:col-span-12">
        <p className="label text-white/45">{staff ? "Recruiter" : "Driver portal"}</p>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
          <h1 className="display">Hi{first ? `, ${first}` : ""}.</h1>
          <form action={signOut}>
            <input type="hidden" name="locale" value={lang} />
            <button className="h-11 rounded border border-white/20 px-5 text-sm text-white/80 hover:border-white hover:text-white">Log out</button>
          </form>
        </div>
      </header>

      <div className="space-y-4 lg:col-span-7">
        <div className="border border-white/10 bg-navy p-7">
          <p className="label text-white/45">Your applications</p>
          {leads && leads.length > 0 ? (
            <ul className="mt-6 divide-y divide-white/10">
              {leads.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-4 py-4">
                  <span>
                    <span className="block font-medium">CDL-A {l.driver_type} driver</span>
                    <span className="text-sm text-white/50">{new Date(l.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  </span>
                  <span className="label rounded-full border border-white/20 px-3 py-1.5 text-white/80">{statusLabel[l.status] ?? l.status}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-6">
              <p className="text-white/65">No application linked to this account yet.</p>
              <Link href={p(routes.applyDriver)} className="mt-4 inline-flex items-center gap-2 font-medium text-signal">
                Start the 2-minute application <Arrow />
              </Link>
            </div>
          )}
        </div>

        <div className="border border-white/10 p-7">
          <p className="label text-white/45">Full DOT application</p>
          <h2 className="h3 mt-4">Coming to your portal next.</h2>
          <p className="mt-3 text-white/60">
            Soon you&apos;ll finish your complete employment application here — license, work history, safety record, documents and e-signatures — and save your progress as you go.
            For now, our recruiter will walk you through it on your call.
          </p>
        </div>
      </div>

      <aside className="lg:col-span-4 lg:col-start-9">
        <div className="border border-white/10 p-7">
          <p className="label text-white/45">Questions?</p>
          <a href={`tel:${company.phone.e164}`} className="mt-4 block text-2xl font-semibold hover:text-signal">{company.phone.display}</a>
          <p className="mt-2 text-white/55">{company.owner} · {company.timeZone}</p>
        </div>
      </aside>
    </div>
  );
}
