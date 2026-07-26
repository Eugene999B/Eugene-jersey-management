import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-token";
import { isTrustedApplicationOrigin, publicRequestOrigin } from "@/lib/request-origin";

export async function GET(request: NextRequest) {
  // GET is intentionally non-destructive. Next.js may prefetch links, so a GET
  // logout endpoint must never clear an authenticated session.
  return NextResponse.redirect(new URL("/login", publicRequestOrigin(request)), 303);
}

export async function POST(request: NextRequest) {
  if (!isTrustedApplicationOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const response = NextResponse.redirect(new URL("/login?loggedOut=1", publicRequestOrigin(request)), 303);
  response.cookies.delete(SESSION_COOKIE);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Clear-Site-Data", '"cache", "storage"');
  return response;
}
