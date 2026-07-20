"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { setSessionCookie, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";

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

function cleanLoginId(value: string | undefined) {
  return value?.trim() ?? "";
}

async function findLoginUser(input: { email?: string; loginId?: string }) {
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

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    loginId: formData.get("loginId") || undefined,
    email: formData.get("email"),
    password: formData.get("password"),
    shopLoginId: formData.get("shopLoginId") || undefined,
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    redirect("/login?error=invalid");
  }

  const user = await findLoginUser(parsed.data);

  if (!user || !user.isActive) {
    redirect("/login?error=invalid");
  }

  if (user.lockUntil && user.lockUntil > new Date()) {
    redirect("/login?error=locked");
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
      metadata: { failedLoginCount },
    });
    redirect(`/login?error=${shouldLock ? "locked" : "invalid"}`);
  }

  const needsShopId = user.shopId && user.role !== Role.SUPPLIER;
  if (needsShopId) {
    const enteredShopId = (parsed.data.shopLoginId || parsed.data.loginId)?.trim().toUpperCase();
    const validShopIds = [user.shop?.staffLoginId, user.shop?.networkCode, user.shop?.slug]
      .filter(Boolean)
      .map((value) => String(value).toUpperCase());
    if (!enteredShopId || !validShopIds.includes(enteredShopId)) {
      redirect("/login?error=shop-id");
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

  await setSessionCookie({
    id: user.id,
    shopId: user.shopId,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  redirect(safeNext(parsed.data.next, user.role));
}
