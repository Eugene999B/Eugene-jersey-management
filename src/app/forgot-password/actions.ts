"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { PhoneVerificationPurpose } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createPlainToken, hashToken, minutesFromNow } from "@/lib/tokens";
import { audit } from "@/lib/audit";
import { createPhoneCode } from "@/lib/phone-codes";

const schema = z.object({
  emailOrPhone: z.string().min(3),
});

export async function requestPasswordResetAction(formData: FormData) {
  const parsed = schema.safeParse({ emailOrPhone: formData.get("emailOrPhone") });
  if (!parsed.success) redirect("/forgot-password?sent=1");

  const identifier = parsed.data.emailOrPhone.trim();
  const user = identifier.includes("@")
    ? await prisma.user.findUnique({ where: { email: identifier.toLowerCase() } })
    : await prisma.user.findFirst({ where: { phone: identifier } });

  if (user) {
    if (user.phone) {
      await createPhoneCode({
        userId: user.id,
        shopId: user.shopId,
        phone: user.phone,
        name: user.name,
        purpose: PhoneVerificationPurpose.STAFF_PASSWORD_RESET,
        minutes: 10,
      });
    } else {
      const token = createPlainToken();
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: minutesFromNow(30),
        },
      });
      console.log(`Password reset link: ${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${token}`);
    }

    await audit({
      shopId: user.shopId,
      userId: user.id,
      action: "auth.password_reset_requested",
      entityType: "User",
      entityId: user.id,
    });
  }

  redirect(`/reset-password?sent=1&phone=${encodeURIComponent(identifier.includes("@") ? "" : identifier)}`);
}
