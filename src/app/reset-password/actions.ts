"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { hashToken } from "@/lib/tokens";
import { audit } from "@/lib/audit";

const schema = z.object({
  token: z.string().min(20),
  password: z.string().min(8),
});

export async function resetPasswordAction(formData: FormData) {
  const parsed = schema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });

  if (!parsed.success) redirect("/reset-password?error=invalid");

  const reset = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(parsed.data.token) },
    include: { user: true },
  });

  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    redirect("/reset-password?error=expired");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: reset.userId },
      data: {
        passwordHash: await hashPassword(parsed.data.password),
        failedLoginCount: 0,
        lockUntil: null,
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        shopId: reset.user.shopId,
        userId: reset.userId,
        action: "auth.password_reset_completed",
        entityType: "User",
        entityId: reset.userId,
        metadata: {},
      },
    }),
  ]);

  await audit({
    shopId: reset.user.shopId,
    userId: reset.userId,
    action: "auth.password_reset_redirect",
    entityType: "User",
    entityId: reset.userId,
  });

  redirect("/login?reset=1");
}
