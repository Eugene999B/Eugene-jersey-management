import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from "@/lib/session-token";
import { persistentSessionCookieOptions } from "@/lib/session-cookie";
import { enforceRateLimit } from "@/lib/rate-limit";

const DUMMY_PASSWORD_HASH = "$2b$12$94A4bgZTq1kkieE.ysBmou2Q7M1Q7es6ib1sj4arKxG9fsC2iDZ3W";
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

const loginSchema = z.object({
  loginId: z.string().trim().min(1).max(180).optional(),
  email: z.string().email().transform((value) => value.toLowerCase()).optional(),
  password: z.string().min(1).max(200),
  next: z.string().max(500).optional(),
}).refine((value) => value.email || value.loginId, { path: ["loginId"] });

function safeNext(value: string | undefined, role: Role) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    if (role === Role.SUPPLIER) return "/supplier";
    return role === Role.SUPER_ADMIN ? "/admin" : "/dashboard";
  }
  if (role === Role.SUPPLIER && !value.startsWith("/supplier")) return "/supplier";
  if (role !== Role.SUPER_ADMIN && value.startsWith("/admin")) return "/dashboard";
  if (role === Role.SUPER_ADMIN && value.startsWith("/dashboard")) return "/admin";
  return value;
}

function wantsJson(request: NextRequest) {
  return request.headers.get("x-ejm-login") === "fetch"
    || request.headers.get("accept")?.includes("application/json") === true;
}

function loginFailure(
  request: NextRequest,
  error: string,
  options: { next?: string | null; loginId?: string | null; status?: number } = {},
) {
  if (wantsJson(request)) {
    const response = NextResponse.json(
      { ok: false, error },
      {
        status: options.status ?? (error === "rate" ? 429 : 401),
        headers: { "Cache-Control": "no-store" },
      },
    );
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  const url = new URL("/login", request.url);
  url.searchParams.set("error", error);
  if (options.next && options.next.startsWith("/") && !options.next.startsWith("//")) {
    url.searchParams.set("next", options.next);
  }
  if (options.loginId) url.searchParams.set("loginId", options.loginId.slice(0, 180));
  const response = NextResponse.redirect(url, 303);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

function requestIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

async function findLoginUser(input: { email?: string; loginId?: string }) {
  if (input.email) {
    return prisma.user.findUnique({ where: { email: input.email }, include: { shop: true } });
  }
  const loginId = input.loginId?.trim();
  if (!loginId) return null;
  return prisma.user.findFirst({
    where: {
      OR: [
        { adminLoginId: loginId.toUpperCase() },
        { email: loginId.toLowerCase() },
      ],
    },
    include: { shop: true },
  });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const parsed = loginSchema.safeParse({
    loginId: formData.get("loginId") || undefined,
    email: formData.get("email") || undefined,
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    return loginFailure(request, "invalid", {
      status: 400,
      next: String(formData.get("next") ?? ""),
      loginId: String(formData.get("loginId") ?? ""),
    });
  }

  const identifier = (parsed.data.loginId ?? parsed.data.email ?? "unknown").trim().toLowerCase();
  try {
    await Promise.all([
      enforceRateLimit({ key: `staff-login-account:${identifier}`, limit: 10, windowSeconds: 15 * 60 }),
      enforceRateLimit({ key: `staff-login-ip:${requestIp(request)}`, limit: 60, windowSeconds: 15 * 60 }),
    ]);
  } catch {
    return loginFailure(request, "rate", {
      next: parsed.data.next,
      loginId: parsed.data.loginId,
      status: 429,
    });
  }

  const user = await findLoginUser(parsed.data);
  const now = new Date();
  if (!user || !user.isActive || (user.shopId && !user.shop?.isActive)) {
    await verifyPassword(parsed.data.password, DUMMY_PASSWORD_HASH);
    return loginFailure(request, "invalid", { next: parsed.data.next, loginId: parsed.data.loginId });
  }

  if (user.lockUntil && user.lockUntil > now) {
    await verifyPassword(parsed.data.password, DUMMY_PASSWORD_HASH);
    return loginFailure(request, "rate", {
      next: parsed.data.next,
      loginId: parsed.data.loginId,
      status: 429,
    });
  }

  const validPassword = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!validPassword) {
    const failedLoginCount = user.lockUntil && user.lockUntil <= now ? 1 : user.failedLoginCount + 1;
    const lockUntil = failedLoginCount >= MAX_FAILED_LOGINS
      ? new Date(now.getTime() + LOCK_MINUTES * 60_000)
      : null;

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount, lockUntil },
    });
    await audit({
      shopId: user.shopId,
      userId: user.id,
      action: lockUntil ? "auth.account_temporarily_locked" : "auth.login_failed",
      entityType: "User",
      entityId: user.id,
      metadata: { failedLoginCount, loginId: parsed.data.loginId ?? parsed.data.email ?? null },
    });
    return loginFailure(request, lockUntil ? "rate" : "invalid", {
      next: parsed.data.next,
      loginId: parsed.data.loginId,
      status: lockUntil ? 429 : 401,
    });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockUntil: null, lastLoginAt: now },
  });
  await audit({
    shopId: user.shopId,
    userId: user.id,
    action: "auth.login",
    entityType: "User",
    entityId: user.id,
  });

  const token = await signSession({
    id: user.id,
    shopId: user.shopId,
    email: user.email,
    name: user.name,
    role: user.role,
    sessionVersion: user.sessionVersion,
  });
  const redirectPath = safeNext(parsed.data.next, user.role);
  const response = wantsJson(request)
    ? NextResponse.json(
        { ok: true, redirectPath },
        { headers: { "Cache-Control": "no-store" } },
      )
    : NextResponse.redirect(new URL(redirectPath, request.url), 303);
  response.cookies.set(SESSION_COOKIE, token, persistentSessionCookieOptions(SESSION_TTL_SECONDS));
  return response;
}
