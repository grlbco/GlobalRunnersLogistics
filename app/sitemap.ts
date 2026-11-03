import type { MetadataRoute } from "next";
import { company } from "@/content/facts";
import { jobs } from "@/content/jobs";
import { places } from "@/content/locations";
import { legalDocs } from "@/content/legal";

/** English pages + Spanish pages that are fully translated (home, apply). docs/plan/06 */
export default function sitemap(): MetadataRoute.Sitemap {
  const u = (path: string) => `${company.url}${path === "/" ? "" : path}`;
  const lastModified = new Date("2026-11-03");
  const entry = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = "monthly", es = false) => ({
    url: u(path),
    lastModified,
    changeFrequency,
    priority,
    ...(es ? { alternates: { languages: { en: u(path), es: `${company.url}/es${path === "/" ? "" : path}` } } } : {}),
  });

  return [
    entry("/", 1, "weekly", true),
    entry("/apply/driver", 0.9, "monthly", true),
    entry("/drive", 0.9, "weekly"),
    ...jobs.map((j) => entry(`/drive/${j.slug}`, 0.9, "weekly")),
    entry("/owner-operators", 0.7),
    entry("/about", 0.6),
    entry("/locations", 0.7),
    ...places.map((p) => entry(`/locations/${p.slug}`, 0.7)),
    entry("/lanes/nevada-georgia", 0.6),
    entry("/faq", 0.7),
    entry("/contact", 0.6),
    ...legalDocs.map((d) => entry(`/legal/${d.slug}`, 0.2, "yearly")),
  ];
}
