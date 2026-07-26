"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PhoneVerificationPurpose } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { createPhoneCode } from "@/lib/phone-codes";
import { enforceRateLimit } from "@/lib/rate-limit";
import { normalizePhone, phoneRateKey } from "@/lib/phone";

const schema = z.object({
  emailOrPhone: z.string().trim().min(3).max(180),
});

async function requestIp() {
  const requestHeaders = await headers();
  return requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    || requestHeaders.get("x-real-ip")
    || "unknown";
}

export async function requestPasswordResetAction(formData: FormData) {
  const parsed = schema.safeParse({ emailOrPhone: formData.get("emailOrPhone") });
  if (!parsed.success) redirect("/forgot-password?sent=1");

  const identifier = parsed.data.emailOrPhone;
  const isEmail = identifier.includes("@");
  const normalizedIdentifier = isEmail ? identifier.toLowerCase() : normalizePhone(identifier);
  try {
    await Promise.all([
      enforceRateLimit({
        key: `password-reset:${isEmail ? normalizedIdentifier : phoneRateKey(normalizedIdentifier)}`,
        limit: 4,
        windowSeconds: 15 * 60,
      }),
      enforceRateLimit({
        key: `password-reset-ip:${await requestIp()}`,
        limit: 20,
        windowSeconds: 15 * 60,
      }),
    ]);
  } catch {
    redirect("/forgot-password?sent=1");
  }

  const candidates = isEmail
    ? await prisma.user.findMany({
        where: {
          email: normalizedIdentifier,
          isActive: true,
          OR: [{ shopId: null }, { shop: { isActive: true } }],
        },
        take: 2,
      })
    : await prisma.user.findMany({
        where: {
          phone: normalizedIdentifier,
          isActive: true,
          OR: [{ shopId: null }, { shop: { isActive: true } }],
        },
        take: 2,
      });

  // A phone number is not unique in the User schema, so never choose an
  // arbitrary account when more than one active user shares it.
  const user = candidates.length === 1 ? candidates[0] : null;
  if (user?.phone) {
    const delivered = await createPhoneCode({
      userId: user.id,
      shopId: user.shopId,
      phone: user.phone,
      name: user.name,
      purpose: PhoneVerificationPurpose.STAFF_PASSWORD_RESET,
      minutes: 10,
    }).then(() => true).catch(() => false);

    await audit({
      shopId: user.shopId,
      userId: user.id,
      action: "auth.password_reset_requested",
      entityType: "User",
      entityId: user.id,
      metadata: { deliveryAccepted: delivered },
    });
  }

  const phoneHint = isEmail ? "" : normalizedIdentifier;
  redirect(`/reset-password?sent=1&phone=${encodeURIComponent(phoneHint)}`);
}
