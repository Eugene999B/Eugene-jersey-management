import { AccountKind } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  accountSessionMetadataFromHeaders,
  createAccountSession,
} from "@/lib/account-sessions";
import { audit } from "@/lib/audit";
import {
  BUYER_SESSION_COOKIE,
  BUYER_SESSION_TTL_SECONDS,
  signBuyerSession,
} from "@/lib/buyer-session";
import { platformDb } from "@/lib/platform-db";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isTrustedApplicationOrigin, publicRequestOrigin } from "@/lib/request-origin";
import { persistentSessionCookieOptions } from "@/lib/session-cookie";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from "@/lib/session-token";
import { verifyTwoFactorLogin } from "@/lib/two-factor-account";
import {
  TWO_FACTOR_CHALLENGE_COOKIE,
  verifyTwoFactorChallenge,
} from "@/lib/two-factor-challenge";

const verificationSchema = z.object({
  code: z.string().trim().min(6).max(32),
});

function requestIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

function safeRedirectPath(value: string, fallback: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

function failure(error: string, status: number, clearChallenge = false) {
  const response = NextResponse.json(
    { ok: false, error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(BUYER_SESSION_COOKIE);
  if (clearChallenge) response.cookies.delete(TWO_FACTOR_CHALLENGE_COOKIE);
  return response;
}

export async function POST(request: NextRequest) {
  if (!isTrustedApplicationOrigin(request)) return failure("origin", 403, true);

  const challengeToken = request.cookies.get(TWO_FACTOR_CHALLENGE_COOKIE)?.value;
  if (!challengeToken) return failure("expired", 401, true);
  const challenge = await verifyTwoFactorChallenge(challengeToken);
  if (!challenge) return failure("expired", 401, true);

  let parsed: z.infer<typeof verificationSchema>;
  try {
    const formData = await request.formData();
    const result = verificationSchema.safeParse({ code: formData.get("code") });
    if (!result.success) return failure("invalid", 400);
    parsed = result.data;
  } catch {
    return failure("invalid", 400);
  }

  try {
    await Promise.all([
      enforceRateLimit({ key: `two-factor-challenge:${challenge.challengeId}`, limit: 8, windowSeconds: 10 * 60 }),
      enforceRateLimit({ key: `two-factor-ip:${requestIp(request)}`, limit: 40, windowSeconds: 15 * 60 }),
    ]);
  } catch {
    return failure("rate", 429, true);
  }

  const wantsJson = request.headers.get("accept")?.includes("application/json") === true;

  if (challenge.accountKind === AccountKind.USER) {
    const user = await platformDb.user.findUnique({
      where: { id: challenge.accountId },
      include: { shop: true },
    });
    if (
      !user
      || !user.isActive
      || user.sessionVersion !== challenge.sessionVersion
      || (user.shopId && !user.shop?.isActive)
    ) return failure("expired", 401, true);

    const valid = await verifyTwoFactorLogin(
      { accountKind: AccountKind.USER, accountId: user.id },
      parsed.code,
    );
    if (!valid) {
      await audit({
        shopId: user.shopId,
        userId: user.id,
        action: "auth.two_factor_failed",
        entityType: "User",
        entityId: user.id,
      });
      return failure("invalid", 401);
    }

    const now = new Date();
    await platformDb.user.update({ where: { id: user.id }, data: { lastLoginAt: now } });
    await audit({
      shopId: user.shopId,
      userId: user.id,
      action: "auth.login",
      entityType: "User",
      entityId: user.id,
      metadata: { twoFactor: true },
    });

    const accountSession = await createAccountSession({
      accountKind: AccountKind.USER,
      accountId: user.id,
      ttlSeconds: SESSION_TTL_SECONDS,
      metadata: accountSessionMetadataFromHeaders(request.headers),
    });
    const sessionToken = await signSession({
      id: user.id,
      shopId: user.shopId,
      email: user.email,
      name: user.name,
      role: user.role,
      sessionVersion: user.sessionVersion,
      sessionId: accountSession.id,
    });
    const redirectPath = safeRedirectPath(challenge.redirectPath, "/dashboard");
    const response = wantsJson
      ? NextResponse.json({ ok: true, redirectPath }, { headers: { "Cache-Control": "no-store" } })
      : NextResponse.redirect(new URL(redirectPath, publicRequestOrigin(request)), 303);
    response.cookies.delete(TWO_FACTOR_CHALLENGE_COOKIE);
    response.cookies.delete(BUYER_SESSION_COOKIE);
    response.cookies.set(SESSION_COOKIE, sessionToken, persistentSessionCookieOptions(SESSION_TTL_SECONDS));
    return response;
  }

  const buyer = await platformDb.buyerAccount.findUnique({ where: { id: challenge.accountId } });
  if (
    !buyer
    || !buyer.isActive
    || buyer.updatedAt.getTime() !== challenge.sessionVersion
  ) return failure("expired", 401, true);

  const valid = await verifyTwoFactorLogin(
    { accountKind: AccountKind.BUYER, accountId: buyer.id },
    parsed.code,
  );
  if (!valid) {
    await audit({
      action: "auth.two_factor_failed",
      entityType: "BuyerAccount",
      entityId: buyer.id,
    });
    return failure("invalid", 401);
  }

  const updatedBuyer = await platformDb.buyerAccount.update({
    where: { id: buyer.id },
    data: { lastLoginAt: new Date() },
  });
  await audit({
    action: "auth.login",
    entityType: "BuyerAccount",
    entityId: buyer.id,
    metadata: { twoFactor: true },
  });

  const accountSession = await createAccountSession({
    accountKind: AccountKind.BUYER,
    accountId: updatedBuyer.id,
    ttlSeconds: BUYER_SESSION_TTL_SECONDS,
    metadata: accountSessionMetadataFromHeaders(request.headers),
  });
  const buyerToken = await signBuyerSession({
    id: updatedBuyer.id,
    phone: updatedBuyer.phone,
    email: updatedBuyer.email,
    name: updatedBuyer.name,
    sessionVersion: updatedBuyer.updatedAt.getTime(),
    sessionId: accountSession.id,
  });
  const redirectPath = safeRedirectPath(challenge.redirectPath, "/shops");
  const response = wantsJson
    ? NextResponse.json({ ok: true, redirectPath }, { headers: { "Cache-Control": "no-store" } })
    : NextResponse.redirect(new URL(redirectPath, publicRequestOrigin(request)), 303);
  response.cookies.delete(TWO_FACTOR_CHALLENGE_COOKIE);
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.set(BUYER_SESSION_COOKIE, buyerToken, persistentSessionCookieOptions(BUYER_SESSION_TTL_SECONDS));
  return response;
}
