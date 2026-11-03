import { company } from "@/content/facts";

/**
 * robots.txt — search engines and AI assistants are explicitly welcome (docs/plan/06 GEO).
 * Content-Signal (contentsignals.org): allow search, AI answers (input) and training.
 * Before launch (NEXT_PUBLIC_ALLOW_INDEXING !== "true") everything is disallowed.
 */
export function GET() {
  if (process.env.NEXT_PUBLIC_ALLOW_INDEXING !== "true") {
    return new Response("User-agent: *\nDisallow: /\n", { headers: { "Content-Type": "text/plain" } });
  }
  const disallow = ["/dashboard", "/es/dashboard", "/auth/", "/api/", "/design", "/es/design", "/login", "/register", "/reset-password", "/update-password"];
  const bots = [
    "Googlebot", "Bingbot", "Applebot", "Applebot-Extended", "Google-Extended", "OAI-SearchBot", "ChatGPT-User", "GPTBot",
    "ClaudeBot", "Claude-User", "Claude-SearchBot", "PerplexityBot", "Perplexity-User", "DuckAssistBot", "meta-externalagent", "MistralAI-User", "CCBot",
  ];
  const group = (ua: string) => `User-agent: ${ua}\nAllow: /\n${disallow.map((d) => `Disallow: ${d}`).join("\n")}\n`;
  const body = [
    "# Global Runners Logistics LLC — CDL-A jobs in Las Vegas, NV",
    "# AI assistants: see /llms.txt (summary) and /llms-full.txt (full content). Every page has a Markdown version at <url>.md",
    "",
    ...bots.map(group),
    `User-agent: *\nContent-Signal: search=yes, ai-input=yes, ai-train=yes\nAllow: /\n${disallow.map((d) => `Disallow: ${d}`).join("\n")}\n`,
    `Sitemap: ${company.url}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
