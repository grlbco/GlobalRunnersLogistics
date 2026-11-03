import { allMarkdownPaths, pageMarkdown } from "@/lib/markdown";

/** Every public page as Markdown in one file, for AI assistants that ingest a site in one fetch. */
export function GET() {
  const body = allMarkdownPaths()
    .map((p) => pageMarkdown(p)?.markdown.replace(/^---[\s\S]*?---\n\n/, ""))
    .filter(Boolean)
    .join("\n\n---\n\n");
  return new Response(`# Global Runners Logistics LLC — full site content\n\n${body}`, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
