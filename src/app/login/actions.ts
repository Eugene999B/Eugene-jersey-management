"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { setSessionCookie, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";

const loginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8),
  next: z.string().optional(),
});

function safeNext(value: string | undefined, role: Role) {
  if (!value || !value.startsWith("/")) {
    return role === Role.SUPER_ADMIN ? "/admin" : "/dashboard";
  }

  if (role !== Role.SUPER_ADMIN && value.startsWith("/admin")) {
    return "/dashboard";
  }

  return value;
}

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
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

  if (user.lockUntil && user.lockUntil > new Date()) {
    redirect("/login?error=locked");
  }

  const validPassword = await verifyPassword(parsed.data.password, user.passwordHash);

  if (!validPassword) {
    const failedLoginCount = user.failedLoginCount + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount,
        lockUntil: failedLoginCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
      },
    });
    redirect(failedLoginCount >= 5 ? "/login?error=locked" : "/login?error=invalid");
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
