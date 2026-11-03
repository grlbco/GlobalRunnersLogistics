import type { MetadataRoute } from "next";
import { company } from "@/content/facts";

/**
 * Search and AI-assistant crawlers are explicitly welcome (docs/plan/06 GEO).
 * Before launch (NEXT_PUBLIC_ALLOW_INDEXING !== "true") everything is disallowed.
 */
export default function robots(): MetadataRoute.Robots {
  if (process.env.NEXT_PUBLIC_ALLOW_INDEXING !== "true") {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  const privatePaths = ["/dashboard", "/es/dashboard", "/auth/", "/api/", "/design", "/es/design"];
  const aiAndSearch = [
    "Googlebot",
    "Bingbot",
    "Applebot",
    "Applebot-Extended",
    "Google-Extended",
    "OAI-SearchBot",
    "ChatGPT-User",
    "GPTBot",
    "ClaudeBot",
    "Claude-User",
    "Claude-SearchBot",
    "PerplexityBot",
    "Perplexity-User",
    "DuckAssistBot",
    "meta-externalagent",
  ];
  return {
    rules: [
      ...aiAndSearch.map((userAgent) => ({ userAgent, allow: "/", disallow: privatePaths })),
      { userAgent: "*", allow: "/", disallow: privatePaths },
    ],
    sitemap: `${company.url}/sitemap.xml`,
    host: company.url,
  };
}
