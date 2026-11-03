import { ImageResponse } from "next/og";

export const alt = "Global Runners Logistics — CDL-A jobs in Las Vegas, NV";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Default social card (brand style, no stock imagery). */
export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#0a1220", color: "white", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 26, letterSpacing: 2, color: "#c7cdd6" }}>
          <div style={{ width: 14, height: 14, borderRadius: 7, background: "#e8401c" }} />
          NOW HIRING CDL-A · LAS VEGAS, NV
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 104, fontWeight: 700, lineHeight: 0.95, letterSpacing: -4 }}>
          <span>Your road.</span>
          <span>Your future.</span>
          <span>Our family.</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "#c7cdd6" }}>
          <span>GLOBAL RUNNERS LOGISTICS LLC</span>
          <span>globalrunnerslogistics.com</span>
        </div>
      </div>
    ),
    size,
  );
}
