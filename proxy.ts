import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const NON_DEFAULT_LOCALES = ["es"];

/**
 * English lives at "/" (no prefix), Spanish at "/es".
 * Internally every page sits under app/[lang], so unprefixed paths are rewritten to /en/...
 * and explicit /en/... URLs are redirected to the clean version (one canonical URL per page).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/en" || pathname.startsWith("/en/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/en/, "") || "/";
    return NextResponse.redirect(url, 308);
  }

  const first = pathname.split("/")[1];
  if (NON_DEFAULT_LOCALES.includes(first)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/en${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    // Skip Next internals, API routes, metadata files and anything with a file extension.
    "/((?!_next|api|favicon.ico|robots.txt|sitemap.xml|llms.txt|manifest.webmanifest|.*\\..*).*)",
  ],
};
