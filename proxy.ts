import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { refreshSession } from "@/lib/supabase/proxy";

const NON_DEFAULT_LOCALES = ["es"];
// Routes that need a fresh Supabase session (auth pages + driver portal).
const AUTH_PATHS = /^\/(?:es\/)?(dashboard|login|register|reset-password|update-password|auth)(\/|$)/;
const PROTECTED = /^\/(?:es\/)?dashboard(\/|$)/;

/**
 * 1. English lives at "/" (no prefix), Spanish at "/es". Everything sits under app/[lang] internally,
 *    so unprefixed paths are rewritten to /en/... and explicit /en/... URLs redirect to the clean URL.
 * 2. On auth/portal routes, refresh the Supabase session and guard /dashboard.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Markdown for AI agents: /<path>.md, or Accept: text/markdown preferred over text/html.
  if (pathname.endsWith(".md") && pathname !== "/sitemap.md") {
    const url = request.nextUrl.clone();
    url.pathname = `/md${pathname.slice(0, -3)}`;
    return NextResponse.rewrite(url);
  }
  if (!pathname.includes(".") && !AUTH_PATHS.test(pathname) && prefersMarkdown(request.headers.get("accept"))) {
    const url = request.nextUrl.clone();
    url.pathname = `/md${pathname === "/" ? "/index" : pathname}`;
    return NextResponse.rewrite(url);
  }

  if (pathname === "/en" || pathname.startsWith("/en/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/en/, "") || "/";
    return NextResponse.redirect(url, 308);
  }

  const first = pathname.split("/")[1];
  let response: NextResponse;
  if (NON_DEFAULT_LOCALES.includes(first)) {
    response = NextResponse.next({ request });
  } else {
    const url = request.nextUrl.clone();
    url.pathname = `/en${pathname === "/" ? "" : pathname}`;
    response = NextResponse.rewrite(url, { request });
  }

  if (AUTH_PATHS.test(pathname)) {
    const claims = await refreshSession(request, response);
    if (!claims && PROTECTED.test(pathname)) {
      const url = request.nextUrl.clone();
      const es = pathname.startsWith("/es/");
      url.pathname = es ? "/es/login" : "/login";
      url.searchParams.set("next", pathname);
      const redirect = NextResponse.redirect(url);
      response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
      return redirect;
    }
  }

  response.headers.append("Vary", "Accept");
  if (!pathname.startsWith("/es") && !AUTH_PATHS.test(pathname)) {
    response.headers.set("Link", `<${pathname === "/" ? "/index.md" : `${pathname}.md`}>; rel="alternate"; type="text/markdown"`);
  }
  return response;
}

/** True when the client ranks text/markdown above text/html (q-values). Browsers never send text/markdown. */
function prefersMarkdown(accept: string | null) {
  if (!accept || !accept.includes("text/markdown")) return false;
  const q = (type: string) => {
    for (const part of accept.split(",")) {
      const [t, ...params] = part.trim().split(";");
      if (t.trim() === type) {
        const qp = params.find((x) => x.trim().startsWith("q="));
        return qp ? parseFloat(qp.trim().slice(2)) : 1;
      }
    }
    return 0;
  };
  return q("text/markdown") >= q("text/html");
}

export const config = {
  matcher: [
    // Skip Next internals, API routes, metadata files and anything with a file extension.
    "/((?!_next|api|favicon.ico|robots.txt|sitemap.xml|llms.txt|llms-full.txt|sitemap.md|manifest.webmanifest|opengraph-image|icon|.*\\.(?!md$)[^/]*$).*)",
  ],
};
