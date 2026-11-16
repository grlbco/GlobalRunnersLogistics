import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import "../globals.css";

export const metadata: Metadata = {
  title: "CDL-A application · Global Runners Logistics",
  robots: { index: false, follow: false },
  icons: { icon: "/icon.png", apple: "/apple-icon.png" },
};

// The page fills the phone screen exactly, safe areas respected.
export const viewport: Viewport = {
  themeColor: "#0a1220",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/** Root layout for personal form links (/a/<code>): just the form, no site header, footer or call bar. */
export default function ShortLinkLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} antialiased`}>
      <body className="h-dvh overflow-hidden bg-ink text-white">{children}</body>
    </html>
  );
}
