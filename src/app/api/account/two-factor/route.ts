import { AccountKind } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { BUYER_SESSION_COOKIE, getBuyerSession } from "@/lib/buyer-session";
import { platformDb } from "@/lib/platform-db";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isTrustedApplicationOrigin } from "@/lib/request-origin";
import { SESSION_COOKIE } from "@/lib/session-token";
import {
  beginTwoFactorSetup,
  cancelTwoFactorSetup,
  confirmTwoFactorSetup,
  disableTwoFactor,
  getTwoFactorStatus,
  regenerateRecoveryCodes,
  verifyTwoFactorLogin,
  type TwoFactorAccount,
} from "@/lib/two-factor-account";

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("begin"), password: z.string().min(1).max(200) }),
  z.object({ action: z.literal("confirm"), code: z.string().trim().regex(/^\d{6}$/) }),
  z.object({ action: z.literal("cancel") }),
  z.object({
    action: z.literal("disable"),
    password: z.string().min(1).max(200),
    code: z.string().trim().min(6).max(32),
  }),
  z.object({
    action: z.literal("regenerate"),
    password: z.string().min(1).max(200),
    code: z.string().trim().min(6).max(32),
  }),
]);

type SecurityActor = {
  account: TwoFactorAccount;
  id: string;
  label: string;
  passwordHash: string;
  entityType: "User" | "BuyerAccount";
  shopId: string | null;
  userId: string | null;
  loginPath: string;
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function requestIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

async function securityActor(): Promise<SecurityActor | null> {
  const workforceSession = await getSession();
  if (workforceSession) {
    const user = await platformDb.user.findUnique({
      where: { id: workforceSession.id },
      select: { id: true, email: true, passwordHash: true, isActive: true, shopId: true },
    });
    if (!user?.isActive) return null;
    return {
      account: { accountKind: AccountKind.USER, accountId: user.id },
      id: user.id,
      label: user.email,
      passwordHash: user.passwordHash,
      entityType: "User",
      shopId: user.shopId,
      userId: user.id,
      loginPath: "/login?securityChanged=1",
    };
  }

  const buyerSession = await getBuyerSession();
  if (!buyerSession) return null;
  const buyer = await platformDb.buyerAccount.findUnique({
    where: { id: buyerSession.id },
    select: { id: true, phone: true, email: true, passwordHash: true, isActive: true },
  });
  if (!buyer?.isActive || !buyer.passwordHash) return null;
  return {
    account: { accountKind: AccountKind.BUYER, accountId: buyer.id },
    id: buyer.id,
    label: buyer.email ?? buyer.phone,
    passwordHash: buyer.passwordHash,
    entityType: "BuyerAccount",
    shopId: null,
    userId: null,
    loginPath: "/buyer/login?securityChanged=1",
  };
}

async function recordSecurityAction(actor: SecurityActor, action: string) {
  await audit({
    shopId: actor.shopId,
    userId: actor.userId,
    action,
    entityType: actor.entityType,
    entityId: actor.id,
  });
}

async function revokeAllSessions(actor: SecurityActor) {
  if (actor.account.accountKind === AccountKind.USER) {
    await platformDb.user.update({
      where: { id: actor.id },
      data: { sessionVersion: { increment: 1 } },
    });
    return;
  }
  await platformDb.buyerAccount.update({
    where: { id: actor.id },
    data: { lastLoginAt: new Date() },
  });
}

function signedOutResponse(actor: SecurityActor, message: string) {
  const response = json({ ok: true, redirectPath: actor.loginPath, message });
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(BUYER_SESSION_COOKIE);
  return response;
}

export async function GET(request: NextRequest) {
  if (!isTrustedApplicationOrigin(request)) return json({ ok: false, error: "origin" }, 403);
  const actor = await securityActor();
  if (!actor) return json({ ok: false, error: "unauthorized" }, 401);
  const status = await getTwoFactorStatus(actor.account);
  return json({ ok: true, status });
}

export async function POST(request: NextRequest) {
  if (!isTrustedApplicationOrigin(request)) return json({ ok: false, error: "origin" }, 403);
  const actor = await securityActor();
  if (!actor) return json({ ok: false, error: "unauthorized" }, 401);

  let parsed: z.infer<typeof requestSchema>;
  try {
    const result = requestSchema.safeParse(await request.json());
    if (!result.success) return json({ ok: false, error: "invalid" }, 400);
    parsed = result.data;
  } catch {
    return json({ ok: false, error: "invalid" }, 400);
  }

  try {
    await Promise.all([
      enforceRateLimit({
        key: `account-two-factor:${actor.account.accountKind}:${actor.id}`,
        limit: 20,
        windowSeconds: 15 * 60,
      }),
      enforceRateLimit({ key: `account-two-factor-ip:${requestIp(request)}`, limit: 80, windowSeconds: 15 * 60 }),
    ]);
  } catch {
    return json({ ok: false, error: "rate" }, 429);
  }

  if (parsed.action === "begin") {
    const currentStatus = await getTwoFactorStatus(actor.account);
    if (currentStatus.enabled) return json({ ok: false, error: "already-enabled" }, 409);
    if (!await verifyPassword(parsed.password, actor.passwordHash)) return json({ ok: false, error: "password" }, 401);

    try {
      const setup = await beginTwoFactorSetup(actor.account, actor.label);
      await recordSecurityAction(actor, "auth.two_factor_setup_started");
      return json({
        ok: true,
        setup: {
          secret: setup.secret,
          otpauthUri: setup.otpauthUri,
          recoveryCodes: setup.recoveryCodes,
          expiresAt: setup.expiresAt.toISOString(),
        },
      });
    } catch {
      return json({ ok: false, error: "unavailable" }, 503);
    }
  }

  if (parsed.action === "confirm") {
    const confirmed = await confirmTwoFactorSetup(actor.account, parsed.code);
    if (!confirmed) return json({ ok: false, error: "code" }, 401);
    await revokeAllSessions(actor);
    await recordSecurityAction(actor, "auth.two_factor_enabled");
    return signedOutResponse(actor, "Two-factor authentication was enabled and every existing session was revoked.");
  }

  if (parsed.action === "cancel") {
    await cancelTwoFactorSetup(actor.account);
    await recordSecurityAction(actor, "auth.two_factor_setup_cancelled");
    return json({ ok: true, status: await getTwoFactorStatus(actor.account) });
  }

  if (!await verifyPassword(parsed.password, actor.passwordHash)) return json({ ok: false, error: "password" }, 401);
  const verified = await verifyTwoFactorLogin(actor.account, parsed.code);
  if (!verified) return json({ ok: false, error: "code" }, 401);

  if (parsed.action === "regenerate") {
    try {
      const recoveryCodes = await regenerateRecoveryCodes(actor.account);
      await recordSecurityAction(actor, "auth.two_factor_recovery_codes_regenerated");
      return json({ ok: true, recoveryCodes, status: await getTwoFactorStatus(actor.account) });
    } catch {
      return json({ ok: false, error: "unavailable" }, 503);
    }
  }

  await disableTwoFactor(actor.account);
  await revokeAllSessions(actor);
  await recordSecurityAction(actor, "auth.two_factor_disabled");
  return signedOutResponse(actor, "Two-factor authentication was disabled and every existing session was revoked.");
}
