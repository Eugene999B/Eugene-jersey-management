import { AccountKind } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { BUYER_SESSION_COOKIE } from "@/lib/buyer-session";
import { isTrustedApplicationOrigin, publicRequestOrigin } from "@/lib/request-origin";
import { SESSION_COOKIE } from "@/lib/session-token";
import {
  TWO_FACTOR_CHALLENGE_COOKIE,
  verifyTwoFactorChallenge,
} from "@/lib/two-factor-challenge";

export async function POST(request: NextRequest) {
  if (!isTrustedApplicationOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const token = request.cookies.get(TWO_FACTOR_CHALLENGE_COOKIE)?.value;
  const challenge = token ? await verifyTwoFactorChallenge(token) : null;
  const destination = challenge?.accountKind === AccountKind.BUYER ? "/buyer/login" : "/login";
  const response = NextResponse.redirect(new URL(destination, publicRequestOrigin(request)), 303);
  response.cookies.delete(TWO_FACTOR_CHALLENGE_COOKIE);
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(BUYER_SESSION_COOKIE);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
