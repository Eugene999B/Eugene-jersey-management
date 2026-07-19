import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from "@/lib/session-token";

const loginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
  shopLoginId: z.string().optional(),
  next: z.string().optional(),
});

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

function redirectToLogin(error: string, next?: string | null) {
  const url = new URL("/login", "https://app.local");
  url.searchParams.set("error", error);
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    url.searchParams.set("next", next);
  }

  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: `${url.pathname}${url.search}` },
  });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    shopLoginId: formData.get("shopLoginId") || undefined,
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    return redirectToLogin("invalid", String(formData.get("next") ?? ""));
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    include: { shop: true },
  });

  if (!user || !user.isActive) {
    return redirectToLogin("invalid", parsed.data.next);
  }

  const validPassword = await verifyPassword(parsed.data.password, user.passwordHash);

  if (!validPassword) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockUntil: null,
      },
    });
    return redirectToLogin("invalid", parsed.data.next);
  }

  const needsShopId = user.shopId && user.role !== Role.SUPPLIER;
  if (needsShopId) {
    const enteredShopId = parsed.data.shopLoginId?.trim().toUpperCase();
    const validShopIds = [user.shop?.staffLoginId, user.shop?.networkCode, user.shop?.slug]
      .filter(Boolean)
      .map((value) => String(value).toUpperCase());
    if (!enteredShopId || !validShopIds.includes(enteredShopId)) {
      return redirectToLogin("shop-id", parsed.data.next);
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
