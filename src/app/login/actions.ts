"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { setSessionCookie, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";

const loginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
  shopLoginId: z.string().optional(),
  adminCode: z.string().optional(),
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

function validSuperAdminCode(value: string | undefined) {
  const expected = (process.env.SUPER_ADMIN_ACCESS_CODE ?? "YPMS-ADMIN").trim().toUpperCase();
  return value?.trim().toUpperCase() === expected;
}

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    shopLoginId: formData.get("shopLoginId") || undefined,
    adminCode: formData.get("adminCode") || undefined,
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    redirect("/login?error=invalid");
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    include: { shop: true },
  });

  if (!user || !user.isActive) {
    redirect("/login?error=invalid");
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
    redirect("/login?error=invalid");
  }

  if (user.role === Role.SUPER_ADMIN && !validSuperAdminCode(parsed.data.adminCode)) {
    redirect("/login?error=admin-code");
  }

  const needsShopId = user.shopId && user.role !== Role.SUPPLIER;
  if (needsShopId) {
    const enteredShopId = parsed.data.shopLoginId?.trim().toUpperCase();
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
