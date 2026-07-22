"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { PhoneVerificationPurpose } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { hashToken } from "@/lib/tokens";
import { audit } from "@/lib/audit";
import { consumePhoneCode } from "@/lib/phone-codes";
import { enforceRateLimit } from "@/lib/rate-limit";
import { normalizePhone, phoneRateKey } from "@/lib/phone";

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
    const phone = normalizePhone(parsed.data.phone);
    try {
      await enforceRateLimit({
        key: `password-reset-verify:${phoneRateKey(phone)}`,
        limit: 8,
        windowSeconds: 15 * 60,
      });
    } catch {
      redirect(`/reset-password?error=expired&phone=${encodeURIComponent(phone)}`);
    }
    const consumed = await consumePhoneCode({
      phone,
      purpose: PhoneVerificationPurpose.STAFF_PASSWORD_RESET,
      code: parsed.data.code,
    });

    if (!consumed?.userId) redirect(`/reset-password?error=expired&phone=${encodeURIComponent(phone)}`);
    const user = await prisma.user.findUnique({ where: { id: consumed.userId } });
    if (!user || user.phone !== phone) redirect(`/reset-password?error=expired&phone=${encodeURIComponent(phone)}`);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(parsed.data.password),
        failedLoginCount: 0,
        lockUntil: null,
        sessionVersion: { increment: 1 },
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

  const passwordHash = await hashPassword(parsed.data.password);
  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({ where: { id: reset.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
      if (claimed.count !== 1) throw new Error("RESET_ALREADY_USED");
      await tx.user.update({
        where: { id: reset.userId },
        data: { passwordHash, failedLoginCount: 0, lockUntil: null, sessionVersion: { increment: 1 } },
      });
      await tx.auditLog.create({
        data: { shopId: reset.user.shopId, userId: reset.userId, action: "auth.password_reset_completed", entityType: "User", entityId: reset.userId, metadata: {} },
      });
    });
  } catch {
    redirect("/reset-password?error=expired");
  }

  await audit({
    shopId: reset.user.shopId,
    userId: reset.userId,
    action: "auth.password_reset_redirect",
    entityType: "User",
    entityId: reset.userId,
  });

  redirect("/login?reset=1");
}
