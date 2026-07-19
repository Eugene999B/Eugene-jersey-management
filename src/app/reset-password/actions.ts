"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { PhoneVerificationPurpose } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { hashToken } from "@/lib/tokens";
import { audit } from "@/lib/audit";
import { consumePhoneCode } from "@/lib/phone-codes";

const schema = z.object({
  token: z.string().optional(),
  phone: z.string().optional(),
  code: z.string().optional(),
  password: z.string().min(8),
});

export async function resetPasswordAction(formData: FormData) {
  const parsed = schema.safeParse({
    token: formData.get("token") || undefined,
    phone: formData.get("phone") || undefined,
    code: formData.get("code") || undefined,
    password: formData.get("password"),
  });

  if (!parsed.success) redirect("/reset-password?error=invalid");

  if (parsed.data.phone && parsed.data.code) {
    const user = await prisma.user.findFirst({ where: { phone: parsed.data.phone } });
    if (!user) redirect("/reset-password?error=expired");

    const consumed = await consumePhoneCode({
      userId: user.id,
      phone: user.phone ?? parsed.data.phone,
      purpose: PhoneVerificationPurpose.STAFF_PASSWORD_RESET,
      code: parsed.data.code,
    });

    if (!consumed) redirect(`/reset-password?error=expired&phone=${encodeURIComponent(parsed.data.phone)}`);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(parsed.data.password),
        failedLoginCount: 0,
        lockUntil: null,
      },
    });

    await audit({
      shopId: user.shopId,
      userId: user.id,
      action: "auth.password_reset_completed",
      entityType: "User",
      entityId: user.id,
    });

    redirect("/login?reset=1");
  }

  if (!parsed.data.token || parsed.data.token.length < 20) redirect("/reset-password?error=invalid");

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
