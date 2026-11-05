import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Suspense } from "react";
import "../globals.css";
import { SidebarServer } from "@/components/crm/SidebarServer";
import { LiveSync } from "@/components/crm/LiveSync";

export const metadata: Metadata = {
  title: { default: "Command", template: "%s · Command" },
  robots: { index: false, follow: false },
  icons: { icon: "/icon.png" },
};
export const viewport: Viewport = { themeColor: "#f5f6f8", colorScheme: "light" };

/**
 * Root layout for the staff CRM (separate from the public site: no header/footer/smooth scroll).
 * Light "daylight" version of the brand: canvas behind, content on a white inset panel.
 */
export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`crm ${GeistSans.variable} ${GeistMono.variable} antialiased`}>
      <body className="min-h-dvh bg-canvas text-fg">
        <div className="flex min-h-dvh">
          <Suspense fallback={<div className="hidden w-[15.5rem] shrink-0 md:block" />}>
            <SidebarServer />
          </Suspense>
          <main className="min-w-0 flex-1 pb-20 md:py-2 md:pb-2 md:pr-2">
            <div className="min-h-[calc(100dvh-1rem)] bg-surface md:rounded-[12px] md:border md:border-line md:shadow-card">{children}</div>
          </main>
          <LiveSync dev={process.env.NODE_ENV !== "production"} />
        </div>
      </body>
    </html>
  );
}
