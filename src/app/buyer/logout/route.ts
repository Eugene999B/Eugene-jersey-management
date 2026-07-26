import { NextRequest, NextResponse } from "next/server";
import { BUYER_SESSION_COOKIE } from "@/lib/buyer-session";
import { isTrustedApplicationOrigin, publicRequestOrigin } from "@/lib/request-origin";

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/shops", publicRequestOrigin(request)), 303);
}

export async function POST(request: NextRequest) {
  if (!isTrustedApplicationOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const response = NextResponse.redirect(new URL("/shops?loggedOut=1", publicRequestOrigin(request)), 303);
  response.cookies.delete(BUYER_SESSION_COOKIE);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Clear-Site-Data", '"cache", "storage"');
  return response;
}
