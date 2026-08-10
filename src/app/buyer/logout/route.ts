import { NextRequest, NextResponse } from "next/server";
import { AccountKind } from "@prisma/client";
import { revokeAccountSession } from "@/lib/account-sessions";
import { BUYER_SESSION_COOKIE, getBuyerSession } from "@/lib/buyer-session";
import { isTrustedApplicationOrigin, publicRequestOrigin } from "@/lib/request-origin";
import { TWO_FACTOR_CHALLENGE_COOKIE } from "@/lib/two-factor-challenge";

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/shops", publicRequestOrigin(request)), 303);
}

export async function POST(request: NextRequest) {
  if (!isTrustedApplicationOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const buyer = await getBuyerSession();
  if (buyer) {
    await revokeAccountSession({
      accountKind: AccountKind.BUYER,
      accountId: buyer.id,
      sessionId: buyer.sessionId,
      reason: "logout",
    });
  }

  const response = NextResponse.redirect(new URL("/shops?loggedOut=1", publicRequestOrigin(request)), 303);
  response.cookies.delete(BUYER_SESSION_COOKIE);
  response.cookies.delete(TWO_FACTOR_CHALLENGE_COOKIE);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Clear-Site-Data", '"cache", "storage"');
  return response;
}
