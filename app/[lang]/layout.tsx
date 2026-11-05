import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Suspense, ViewTransition } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "../globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MobileCallBar } from "@/components/layout/MobileCallBar";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { AttributionCapture } from "@/components/forms/fields";
import { getDictionary } from "@/dictionaries";
import { hasLocale, locales } from "@/lib/i18n";
import { company } from "@/content/facts";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    metadataBase: new URL(company.url),
    title: { default: dict.meta.title, template: `%s · ${company.shortName}` },
    description: dict.meta.description,
    applicationName: company.shortName,
    alternates: { canonical: lang === "en" ? "/" : `/${lang}`, languages: { en: "/", es: "/es", "x-default": "/" } },
    openGraph: { type: "website", siteName: company.shortName, locale: lang === "en" ? "en_US" : "es_US" },
    // Search Console / Bing Webmaster verification tokens come from env (set in Vercel).
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
      other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION } : undefined,
    },
    // Indexing stays off until launch (docs/plan/09). Flip via env on production.
    robots: process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true" ? undefined : { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#0a1220",
  colorScheme: "dark",
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <html lang={lang} className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}>
      <body className="min-h-dvh bg-ink text-white">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded focus:bg-signal focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        {/* pathname-based client bits: in Suspense so dynamic pages (like /f/<slug>) can stream */}
        <Suspense fallback={null}>
          <SmoothScroll />
          <AttributionCapture />
        </Suspense>
        <Suspense fallback={null}>
          <Header locale={lang} nav={dict.nav} />
        </Suspense>
        <ViewTransition default="page">
          <main id="main">{children}</main>
        </ViewTransition>
        <Footer locale={lang} dict={dict} />
        <Suspense fallback={null}>
          <MobileCallBar locale={lang} nav={dict.nav} />
        </Suspense>
      </body>
    </html>
  );
}
