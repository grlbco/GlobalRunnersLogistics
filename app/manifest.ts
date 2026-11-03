import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Global Runners Logistics",
    short_name: "Global Runners",
    description: "CDL-A truck driving jobs in Las Vegas & Henderson, NV.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a1220",
    theme_color: "#0a1220",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
