import { allMarkdownPaths, pageMarkdown, mdUrl } from "@/lib/markdown";
import { company } from "@/content/facts";

/** Human/agent-readable sitemap in Markdown. */
export function GET() {
  const lines = allMarkdownPaths().map((p) => {
    const page = pageMarkdown(p)!;
    return `- [${page.title}](${company.url}${p === "/" ? "" : p}) · [markdown](${company.url}${mdUrl(p)})`;
  });
  return new Response(`# ${company.legalName} — sitemap\n\n${lines.join("\n")}\n`, {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
