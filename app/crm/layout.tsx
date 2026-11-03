import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Suspense } from "react";
import "../globals.css";
import { Sidebar } from "@/components/crm/Sidebar";
import { LiveSync } from "@/components/crm/LiveSync";

export const metadata: Metadata = {
  title: { default: "Command", template: "%s · Command" },
  robots: { index: false, follow: false },
  icons: { icon: "/icon.png" },
};
export const viewport: Viewport = { themeColor: "#0a1220", colorScheme: "dark" };

/** Root layout for the staff CRM (separate from the public site: no header/footer/smooth scroll). */
export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}>
      <body className="min-h-dvh bg-ink text-white">
        <div className="flex min-h-dvh">
          <Suspense fallback={<div className="hidden w-60 shrink-0 border-r border-white/[0.07] bg-[#0b1424] md:block" />}>
            <Sidebar />
          </Suspense>
          <main className="min-w-0 flex-1 pb-20 md:pb-0">{children}</main>
          <LiveSync dev={process.env.NODE_ENV !== "production"} />
        </div>
      </body>
    </html>
  );
}
