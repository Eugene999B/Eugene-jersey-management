import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session-token";
import { isTrustedApplicationOrigin, publicRequestOrigin } from "@/lib/request-origin";

function sessionHome(role: Role | undefined) {
  if (role === Role.SUPER_ADMIN) return "/admin";
  if (role === Role.SUPPLIER) return "/supplier";
  if (role) return "/dashboard";
  return "/login";
}

export async function GET(request: NextRequest) {
  // GET is intentionally non-destructive. Next.js may prefetch links or an old
  // browser cache may still contain one, so GET returns the current workspace.
  const session = await getSession();
  return NextResponse.redirect(new URL(sessionHome(session?.role), publicRequestOrigin(request)), 303);
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
