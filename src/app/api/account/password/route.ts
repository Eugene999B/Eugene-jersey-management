import { AccountKind } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { getSession, hashPassword, verifyPassword } from "@/lib/auth";
import { BUYER_SESSION_COOKIE, getBuyerSession } from "@/lib/buyer-session";
import { strongPasswordSchema } from "@/lib/password-policy";
import { platformDb } from "@/lib/platform-db";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isTrustedApplicationOrigin } from "@/lib/request-origin";
import { SESSION_COOKIE } from "@/lib/session-token";

const requestSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: strongPasswordSchema,
  confirmPassword: z.string().min(1).max(200),
}).refine((value) => value.newPassword === value.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

type PasswordActor = {
  accountKind: AccountKind;
  id: string;
  passwordHash: string;
  entityType: "User" | "BuyerAccount";
  shopId: string | null;
  userId: string | null;
  redirectPath: string;
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function requestIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

async function passwordActor(): Promise<PasswordActor | null> {
  const workforceSession = await getSession();
  if (workforceSession) {
    const user = await platformDb.user.findUnique({
      where: { id: workforceSession.id },
      select: { id: true, passwordHash: true, isActive: true, shopId: true },
    });
    if (!user?.isActive) return null;
    return {
      accountKind: AccountKind.USER,
      id: user.id,
      passwordHash: user.passwordHash,
      entityType: "User",
      shopId: user.shopId,
      userId: user.id,
      redirectPath: "/login?passwordChanged=1",
    };
  }

  const buyerSession = await getBuyerSession();
  if (!buyerSession) return null;
  const buyer = await platformDb.buyerAccount.findUnique({
    where: { id: buyerSession.id },
    select: { id: true, passwordHash: true, isActive: true },
  });
  if (!buyer?.isActive || !buyer.passwordHash) return null;
  return {
    accountKind: AccountKind.BUYER,
    id: buyer.id,
    passwordHash: buyer.passwordHash,
    entityType: "BuyerAccount",
    shopId: null,
    userId: null,
    redirectPath: "/buyer/login?passwordChanged=1",
  };
}

export async function POST(request: NextRequest) {
  if (!isTrustedApplicationOrigin(request)) return json({ ok: false, error: "origin" }, 403);
  const actor = await passwordActor();
  if (!actor) return json({ ok: false, error: "unauthorized" }, 401);

  let parsed: z.infer<typeof requestSchema>;
  try {
    const result = requestSchema.safeParse(await request.json());
    if (!result.success) return json({ ok: false, error: "invalid", detail: result.error.issues[0]?.message }, 400);
    parsed = result.data;
  } catch {
    return json({ ok: false, error: "invalid" }, 400);
  }

  try {
    await Promise.all([
      enforceRateLimit({ key: `account-password:${actor.accountKind}:${actor.id}`, limit: 8, windowSeconds: 15 * 60 }),
      enforceRateLimit({ key: `account-password-ip:${requestIp(request)}`, limit: 40, windowSeconds: 15 * 60 }),
    ]);
  } catch {
    return json({ ok: false, error: "rate" }, 429);
  }

  if (!await verifyPassword(parsed.currentPassword, actor.passwordHash)) {
    return json({ ok: false, error: "current-password" }, 401);
  }
  if (await verifyPassword(parsed.newPassword, actor.passwordHash)) {
    return json({ ok: false, error: "same-password" }, 409);
  }

  const passwordHash = await hashPassword(parsed.newPassword);
  if (actor.accountKind === AccountKind.USER) {
    await platformDb.user.update({
      where: { id: actor.id },
      data: {
        passwordHash,
        sessionVersion: { increment: 1 },
        failedLoginCount: 0,
        lockUntil: null,
      },
    });
  } else {
    await platformDb.buyerAccount.update({
      where: { id: actor.id },
      data: { passwordHash, lastLoginAt: new Date() },
    });
  }

  await audit({
    shopId: actor.shopId,
    userId: actor.userId,
    action: "auth.password_changed",
    entityType: actor.entityType,
    entityId: actor.id,
  });

  const response = json({
    ok: true,
    redirectPath: actor.redirectPath,
    message: "Password changed successfully. Sign in again with the new password.",
  });
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(BUYER_SESSION_COOKIE);
  return response;
}
