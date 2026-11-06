import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { Suspense } from "react";
import "../globals.css";
import { SidebarServer } from "@/components/crm/SidebarServer";
import { TopBarServer } from "@/components/crm/TopBarServer";
import { LiveSync } from "@/components/crm/LiveSync";

export const metadata: Metadata = {
  title: { default: "Command", template: "%s · Command" },
  robots: { index: false, follow: false },
  icons: { icon: "/icon.png" },
};
export const viewport: Viewport = { themeColor: "#f6f6f6" };

// Runs before first paint so a dark-theme user never sees a light flash.
const THEME_SCRIPT = `try{if(localStorage.getItem("crm-theme")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;

/** Root layout for the staff CRM (separate from the public site: no header/footer/smooth scroll). */
export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`crm ${GeistSans.variable} antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-canvas text-fg">
        <div className="flex min-h-dvh">
          <Suspense fallback={<div className="hidden w-[5.25rem] shrink-0 md:block" />}>
            <SidebarServer />
          </Suspense>
          <main className="min-w-0 flex-1 pb-24 md:pb-3">
            <Suspense fallback={<div className="h-[84px]" />}>
              <TopBarServer />
            </Suspense>
            {children}
          </main>
          <LiveSync dev={process.env.NODE_ENV !== "production" && process.env.ALLOW_LOCAL_WORKER === "true"} />
        </div>
      </body>
    </html>
  );
}
