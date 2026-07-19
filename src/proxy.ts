import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if ((pathname.startsWith("/dashboard") || pathname.startsWith("/admin") || pathname.startsWith("/supplier")) && !session) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    const response = NextResponse.redirect(url);
    if (token) {
      response.cookies.delete(SESSION_COOKIE);
    }
    return response;
  }

  if (pathname.startsWith("/admin") && session?.role !== "SUPER_ADMIN") {
    return NextResponse.redirect(new URL("/dashboard?error=permission", request.url));
  }

  if (pathname.startsWith("/dashboard") && session?.role === "SUPER_ADMIN") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  if (pathname.startsWith("/dashboard") && session?.role === "SUPPLIER") {
    return NextResponse.redirect(new URL("/supplier", request.url));
  }

  if (pathname.startsWith("/supplier") && session?.role !== "SUPPLIER") {
    return NextResponse.redirect(new URL("/dashboard?error=permission", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/supplier/:path*"],
};
