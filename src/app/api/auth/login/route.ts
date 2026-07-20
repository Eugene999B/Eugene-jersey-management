import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from "@/lib/session-token";

const loginSchema = z.object({
  loginId: z.string().optional(),
  email: z.string().email().transform((value) => value.toLowerCase()).optional(),
  password: z.string().min(1),
  shopLoginId: z.string().optional(),
  next: z.string().optional(),
}).refine((value) => value.email || value.loginId, { path: ["loginId"] });

function safeNext(value: string | undefined, role: Role) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    if (role === Role.SUPPLIER) return "/supplier";
    return role === Role.SUPER_ADMIN ? "/admin" : "/dashboard";
  }

  if (role === Role.SUPPLIER && !value.startsWith("/supplier")) {
    return "/supplier";
  }

  if (role !== Role.SUPER_ADMIN && value.startsWith("/admin")) {
    return "/dashboard";
  }

  if (role === Role.SUPER_ADMIN && value.startsWith("/dashboard")) {
    return "/admin";
  }

  return value;
}

function redirectToLogin(error: string, next?: string | null, loginId?: string | null) {
  const url = new URL("/login", "https://app.local");
  url.searchParams.set("error", error);
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    url.searchParams.set("next", next);
  }
  if (loginId) {
    url.searchParams.set("loginId", loginId);
  }

  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: `${url.pathname}${url.search}` },
  });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

function cleanLoginId(value: string | undefined) {
  return value?.trim() ?? "";
}

async function findLoginUser(input: { email?: string; loginId?: string; shopLoginId?: string }) {
  if (input.email) {
    return prisma.user.findUnique({
      where: { email: input.email },
      include: { shop: true },
    });
  }

  const loginId = cleanLoginId(input.loginId);
  if (!loginId) return null;

  return prisma.user.findFirst({
    where: {
      OR: [
        { adminLoginId: loginId.toUpperCase() },
        { email: loginId.toLowerCase() },
        { phone: loginId },
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
    shopLoginId: formData.get("shopLoginId") || undefined,
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    return redirectToLogin("invalid", String(formData.get("next") ?? ""), String(formData.get("loginId") ?? ""));
  }

  const user = await findLoginUser(parsed.data);

  if (!user || !user.isActive) {
    return redirectToLogin("invalid", parsed.data.next, parsed.data.loginId);
  }

  if (user.lockUntil && user.lockUntil > new Date()) {
    return redirectToLogin("locked", parsed.data.next, parsed.data.loginId);
  }

  const validPassword = await verifyPassword(parsed.data.password, user.passwordHash);

  if (!validPassword) {
    const failedLoginCount = user.failedLoginCount + 1;
    const shouldLock = failedLoginCount >= 6;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount,
        lockUntil: shouldLock ? new Date(Date.now() + 10 * 60 * 1000) : null,
      },
    });
    await audit({
      shopId: user.shopId,
      userId: user.id,
      action: "auth.login_failed",
      entityType: "User",
      entityId: user.id,
      metadata: { failedLoginCount, loginId: parsed.data.loginId ?? parsed.data.email ?? null },
    });
    return redirectToLogin(shouldLock ? "locked" : "invalid", parsed.data.next, parsed.data.loginId);
  }

  const needsShopId = user.shopId && user.role !== Role.SUPPLIER;
  if (needsShopId) {
    const enteredShopId = (parsed.data.shopLoginId || parsed.data.loginId)?.trim().toUpperCase();
    const validShopIds = [user.shop?.staffLoginId, user.shop?.networkCode, user.shop?.slug]
      .filter(Boolean)
      .map((value) => String(value).toUpperCase());
    if (!enteredShopId || !validShopIds.includes(enteredShopId)) {
      return redirectToLogin("shop-id", parsed.data.next, parsed.data.loginId);
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockUntil: null, lastLoginAt: new Date() },
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
  });

  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: safeNext(parsed.data.next, user.role) },
  });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });

  return response;
}
