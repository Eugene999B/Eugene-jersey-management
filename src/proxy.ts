import { NextRequest, NextResponse } from "next/server";
import { canAccessDashboardPath } from "@/lib/dashboard-access";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySessionToken } from "@/lib/session-token";

async function withRefreshedSession(response: NextResponse, session: NonNullable<Awaited<ReturnType<typeof verifySessionToken>>>) {
  response.cookies.set(SESSION_COOKIE, await signSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if ((pathname.startsWith("/dashboard") || pathname.startsWith("/admin") || pathname.startsWith("/supplier")) && !session) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    const response = NextResponse.redirect(url);
    if (token) {
      response.cookies.delete(SESSION_COOKIE);
    }
    return response;
  }

  if (pathname.startsWith("/admin") && session && session.role !== "SUPER_ADMIN") {
    return withRefreshedSession(NextResponse.redirect(new URL("/dashboard?error=permission", request.url)), session);
  }

  if (pathname.startsWith("/dashboard") && session?.role === "SUPER_ADMIN") {
    return withRefreshedSession(NextResponse.redirect(new URL("/admin", request.url)), session);
  }

  if (pathname.startsWith("/dashboard") && session?.role === "SUPPLIER") {
    return withRefreshedSession(NextResponse.redirect(new URL("/supplier", request.url)), session);
  }

  if (pathname.startsWith("/dashboard") && !canAccessDashboardPath(pathname, session?.role)) {
    const url = new URL("/dashboard", request.url);
    url.searchParams.set("error", "permission");
    url.searchParams.set("from", pathname);
    return withRefreshedSession(NextResponse.redirect(url), session!);
  }

  if (pathname.startsWith("/supplier") && session && session.role !== "SUPPLIER") {
    return withRefreshedSession(NextResponse.redirect(new URL("/dashboard?error=permission", request.url)), session);
  }

  return session ? withRefreshedSession(NextResponse.next(), session) : NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/supplier/:path*"],
};
