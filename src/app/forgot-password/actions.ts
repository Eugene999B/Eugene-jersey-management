"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { PhoneVerificationPurpose } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { createPhoneCode } from "@/lib/phone-codes";
import { enforceRateLimit } from "@/lib/rate-limit";
import { normalizePhone, phoneRateKey } from "@/lib/phone";

const schema = z.object({
  emailOrPhone: z.string().min(3),
});

export async function requestPasswordResetAction(formData: FormData) {
  const parsed = schema.safeParse({ emailOrPhone: formData.get("emailOrPhone") });
  if (!parsed.success) redirect("/forgot-password?sent=1");

  const identifier = parsed.data.emailOrPhone.trim();
  try {
    await enforceRateLimit({
      key: `password-reset:${identifier.includes("@") ? identifier.toLowerCase() : phoneRateKey(identifier)}`,
      limit: 4,
      windowSeconds: 15 * 60,
    });
  } catch {
    redirect("/forgot-password?sent=1");
  }
  const user = identifier.includes("@")
    ? await prisma.user.findUnique({ where: { email: identifier.toLowerCase() } })
    : await prisma.user.findFirst({ where: { phone: normalizePhone(identifier) } });

  if (user) {
    if (user.phone) {
      await createPhoneCode({
        userId: user.id,
        shopId: user.shopId,
        phone: user.phone,
        name: user.name,
        purpose: PhoneVerificationPurpose.STAFF_PASSWORD_RESET,
        minutes: 10,
      }).catch(() => undefined);
    }

    await audit({
      shopId: user.shopId,
      userId: user.id,
      action: "auth.password_reset_requested",
      entityType: "User",
      entityId: user.id,
    });
  }

  redirect(`/reset-password?sent=1&phone=${encodeURIComponent(identifier.includes("@") ? "" : normalizePhone(identifier))}`);
}
