"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AccountKind, PasswordRecoveryChannel } from "@prisma/client";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { normalizePhone, phoneRateKey } from "@/lib/phone";
import {
  createPasswordRecoveryChallenge,
  recoveryChannelConfigured,
} from "@/lib/password-recovery";
import { enforceRateLimit } from "@/lib/rate-limit";
import { normaliseEmail } from "@/lib/transactional-email";

const schema = z.object({
  identifier: z.string().trim().min(3).max(180),
  channel: z.nativeEnum(PasswordRecoveryChannel),
  next: z.string().max(500).optional(),
});

function safeNext(value: FormDataEntryValue | string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw.startsWith("/") || raw.startsWith("//") || /^https?:/i.test(raw)) return "/shops";
  return raw;
}

async function requestIp() {
  const requestHeaders = await headers();
  return requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    || requestHeaders.get("x-real-ip")
    || "unknown";
}

async function findActiveBuyer(identifierValue: string) {
  const identifier = identifierValue.trim();
  if (identifier.includes("@")) {
    return prisma.buyerAccount.findFirst({
      where: { email: normaliseEmail(identifier), isActive: true },
    });
  }
  const phone = normalizePhone(identifier);
  return prisma.buyerAccount.findFirst({ where: { phone, isActive: true } });
}

export async function requestBuyerPasswordResetAction(formData: FormData) {
  const parsed = schema.safeParse({
    identifier: formData.get("identifier"),
    channel: formData.get("channel"),
    next: formData.get("next") || undefined,
  });
  const next = safeNext(formData.get("next"));
  if (!parsed.success) redirect(`/buyer/forgot-password?error=invalid&next=${encodeURIComponent(next)}`);
  if (!recoveryChannelConfigured(parsed.data.channel)) {
    redirect(`/buyer/forgot-password?error=${parsed.data.channel === PasswordRecoveryChannel.EMAIL ? "email-provider" : "sms-provider"}&next=${encodeURIComponent(next)}`);
  }

  const isEmail = parsed.data.identifier.includes("@");
  const rateIdentifier = isEmail
    ? normaliseEmail(parsed.data.identifier)
    : phoneRateKey(normalizePhone(parsed.data.identifier));
  try {
    await Promise.all([
      enforceRateLimit({ key: `buyer-password-reset:${rateIdentifier}`, limit: 4, windowSeconds: 15 * 60 }),
      enforceRateLimit({ key: `buyer-password-reset-ip:${await requestIp()}`, limit: 20, windowSeconds: 15 * 60 }),
    ]);
  } catch {
    redirect(`/buyer/forgot-password?sent=1&next=${encodeURIComponent(next)}`);
  }

  const buyer = await findActiveBuyer(parsed.data.identifier);
  const destination = parsed.data.channel === PasswordRecoveryChannel.EMAIL ? buyer?.email : buyer?.phone;
  if (!buyer || !destination) redirect(`/buyer/forgot-password?sent=1&next=${encodeURIComponent(next)}`);

  try {
    await createPasswordRecoveryChallenge({
      accountKind: AccountKind.BUYER,
      accountId: buyer.id,
      channel: parsed.data.channel,
      destination,
      recipientName: buyer.name,
      resetPath: `/buyer/reset-password?next=${encodeURIComponent(next)}`,
      minutes: 10,
    });
    await audit({
      action: "auth.buyer_password_reset_requested",
      entityType: "BuyerAccount",
      entityId: buyer.id,
      metadata: { channel: parsed.data.channel, deliveryAccepted: true },
    });
  } catch {
    await audit({
      action: "auth.buyer_password_reset_requested",
      entityType: "BuyerAccount",
      entityId: buyer.id,
      metadata: { channel: parsed.data.channel, deliveryAccepted: false },
    });
  }
  redirect(`/buyer/forgot-password?sent=1&next=${encodeURIComponent(next)}`);
}