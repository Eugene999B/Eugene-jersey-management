import { AccountKind } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
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

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function requestIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

export async function GET(request: NextRequest) {
  if (!isTrustedApplicationOrigin(request)) return json({ ok: false, error: "origin" }, 403);
  const session = await getSession();
  if (!session) return json({ ok: false, error: "unauthorized" }, 401);
  const status = await getTwoFactorStatus({ accountKind: AccountKind.USER, accountId: session.id });
  return json({ ok: true, status });
}

export async function POST(request: NextRequest) {
  if (!isTrustedApplicationOrigin(request)) return json({ ok: false, error: "origin" }, 403);
  const session = await getSession();
  if (!session) return json({ ok: false, error: "unauthorized" }, 401);

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
      enforceRateLimit({ key: `account-two-factor:${session.id}`, limit: 20, windowSeconds: 15 * 60 }),
      enforceRateLimit({ key: `account-two-factor-ip:${requestIp(request)}`, limit: 80, windowSeconds: 15 * 60 }),
    ]);
  } catch {
    return json({ ok: false, error: "rate" }, 429);
  }

  const user = await platformDb.user.findUnique({
    where: { id: session.id },
    select: { id: true, email: true, passwordHash: true, isActive: true, shopId: true },
  });
  if (!user?.isActive) return json({ ok: false, error: "unauthorized" }, 401);
  const account = { accountKind: AccountKind.USER, accountId: user.id };

  if (parsed.action === "begin") {
    const currentStatus = await getTwoFactorStatus(account);
    if (currentStatus.enabled) return json({ ok: false, error: "already-enabled" }, 409);
    if (!await verifyPassword(parsed.password, user.passwordHash)) return json({ ok: false, error: "password" }, 401);

    try {
      const setup = await beginTwoFactorSetup(account, user.email);
      await audit({
        shopId: user.shopId,
        userId: user.id,
        action: "auth.two_factor_setup_started",
        entityType: "User",
        entityId: user.id,
      });
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
    const confirmed = await confirmTwoFactorSetup(account, parsed.code);
    if (!confirmed) return json({ ok: false, error: "code" }, 401);
    await audit({
      shopId: user.shopId,
      userId: user.id,
      action: "auth.two_factor_enabled",
      entityType: "User",
      entityId: user.id,
    });
    return json({ ok: true, status: await getTwoFactorStatus(account) });
  }

  if (parsed.action === "cancel") {
    await cancelTwoFactorSetup(account);
    await audit({
      shopId: user.shopId,
      userId: user.id,
      action: "auth.two_factor_setup_cancelled",
      entityType: "User",
      entityId: user.id,
    });
    return json({ ok: true, status: await getTwoFactorStatus(account) });
  }

  if (!await verifyPassword(parsed.password, user.passwordHash)) return json({ ok: false, error: "password" }, 401);
  const verified = await verifyTwoFactorLogin(account, parsed.code);
  if (!verified) return json({ ok: false, error: "code" }, 401);

  if (parsed.action === "regenerate") {
    try {
      const recoveryCodes = await regenerateRecoveryCodes(account);
      await audit({
        shopId: user.shopId,
        userId: user.id,
        action: "auth.two_factor_recovery_codes_regenerated",
        entityType: "User",
        entityId: user.id,
      });
      return json({ ok: true, recoveryCodes, status: await getTwoFactorStatus(account) });
    } catch {
      return json({ ok: false, error: "unavailable" }, 503);
    }
  }

  await disableTwoFactor(account);
  await platformDb.user.update({
    where: { id: user.id },
    data: { sessionVersion: { increment: 1 } },
  });
  await audit({
    shopId: user.shopId,
    userId: user.id,
    action: "auth.two_factor_disabled",
    entityType: "User",
    entityId: user.id,
  });
  const response = json({ ok: true, redirectPath: "/login?securityChanged=1" });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
