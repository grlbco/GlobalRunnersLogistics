import { pageMarkdown } from "@/lib/markdown";

/** Markdown representation of a page. Reached via /<path>.md or Accept: text/markdown (see proxy.ts). */
export async function GET(_req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path } = await ctx.params;
  const p = "/" + (path ?? []).join("/");
  const page = pageMarkdown(p === "/index" ? "/" : p);
  if (!page) return new Response("Not found", { status: 404 });
  const canonical = `https://globalrunnerslogistics.com${page.path === "/" ? "" : page.path}`;
  return new Response(page.markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      Vary: "Accept",
      Link: `<${canonical}>; rel="canonical"`,
      "X-Robots-Tag": "noindex", // the HTML page is the indexable version
      "Content-Signal": "search=yes, ai-input=yes, ai-train=yes",
    },
  });
}
