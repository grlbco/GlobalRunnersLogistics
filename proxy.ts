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

  return response;
}

export const config = {
  matcher: [
    // Skip Next internals, API routes, metadata files and anything with a file extension.
    "/((?!_next|api|favicon.ico|robots.txt|sitemap.xml|llms.txt|llms-full.txt|manifest.webmanifest|opengraph-image|icon|.*\\..*).*)",
  ],
};
