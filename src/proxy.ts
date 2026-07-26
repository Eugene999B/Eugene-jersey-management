import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-token";

const protectedPrefixes = ["/dashboard", "/admin", "/supplier"] as const;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  // Proxy performs only the optimistic cookie-presence check. Authoritative JWT,
  // database, tenant, session-version, and role checks stay in server layouts and
  // actions, where false negatives cannot erase an otherwise valid session.
  if (protectedPrefixes.some((prefix) => pathname.startsWith(prefix)) && !hasSessionCookie) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/supplier/:path*"],
};
