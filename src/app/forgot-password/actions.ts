"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AccountKind, PasswordRecoveryChannel } from "@prisma/client";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";
import { normalizePhone, phoneRateKey } from "@/lib/phone";
import {
  createPasswordRecoveryChallenge,
  recoveryChannelConfigured,
} from "@/lib/password-recovery";

const schema = z.object({
  identifier: z.string().trim().min(3).max(180),
  channel: z.nativeEnum(PasswordRecoveryChannel),
});

async function requestIp() {
  const requestHeaders = await headers();
  return requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    || requestHeaders.get("x-real-ip")
    || "unknown";
}

async function findActiveStaff(identifierValue: string) {
  const identifier = identifierValue.trim();
  const email = identifier.toLowerCase();
  const digits = identifier.replace(/\D/g, "");

  if (identifier.includes("@")) {
    return prisma.user.findFirst({
      where: {
        email,
        isActive: true,
        OR: [{ shopId: null }, { shop: { isActive: true } }],
      },
    });
  }

  if (digits.length >= 8) {
    const phone = normalizePhone(identifier);
    const candidates = await prisma.user.findMany({
      where: {
        phone,
        isActive: true,
        OR: [{ shopId: null }, { shop: { isActive: true } }],
      },
      take: 2,
    });
    return candidates.length === 1 ? candidates[0] : null;
  }

  return prisma.user.findFirst({
    where: {
      adminLoginId: { equals: identifier, mode: "insensitive" },
      isActive: true,
      OR: [{ shopId: null }, { shop: { isActive: true } }],
    },
  });
}

export async function requestPasswordResetAction(formData: FormData) {
  const parsed = schema.safeParse({
    identifier: formData.get("identifier"),
    channel: formData.get("channel"),
  });
  if (!parsed.success) redirect("/forgot-password?error=invalid");
  if (!recoveryChannelConfigured(parsed.data.channel)) {
    redirect(`/forgot-password?error=${parsed.data.channel === PasswordRecoveryChannel.EMAIL ? "email-provider" : "sms-provider"}`);
  }

  const rateIdentifier = parsed.data.identifier.includes("@")
    ? parsed.data.identifier.toLowerCase()
    : parsed.data.identifier.replace(/\D/g, "").length >= 8
      ? phoneRateKey(normalizePhone(parsed.data.identifier))
      : parsed.data.identifier.toLowerCase();

  try {
    await Promise.all([
      enforceRateLimit({ key: `staff-password-reset:${rateIdentifier}`, limit: 4, windowSeconds: 15 * 60 }),
      enforceRateLimit({ key: `staff-password-reset-ip:${await requestIp()}`, limit: 20, windowSeconds: 15 * 60 }),
    ]);
  } catch {
    redirect("/forgot-password?sent=1");
  }

  const user = await findActiveStaff(parsed.data.identifier);
  const destination = parsed.data.channel === PasswordRecoveryChannel.EMAIL ? user?.email : user?.phone;
  if (!user || !destination) redirect("/forgot-password?sent=1");

  try {
    await createPasswordRecoveryChallenge({
      accountKind: AccountKind.USER,
      accountId: user.id,
      channel: parsed.data.channel,
      destination,
      recipientName: user.name,
      resetPath: "/reset-password",
      minutes: 10,
    });
    await audit({
      shopId: user.shopId,
      userId: user.id,
      action: "auth.password_reset_requested",
      entityType: "User",
      entityId: user.id,
      metadata: { channel: parsed.data.channel, deliveryAccepted: true },
    });
  } catch {
    await audit({
      shopId: user.shopId,
      userId: user.id,
      action: "auth.password_reset_requested",
      entityType: "User",
      entityId: user.id,
      metadata: { channel: parsed.data.channel, deliveryAccepted: false },
    });
  }
  redirect("/forgot-password?sent=1");
}