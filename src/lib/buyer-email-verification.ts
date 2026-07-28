import "server-only";

import { randomInt, timingSafeEqual } from "node:crypto";
import { EmailDeliveryStatus } from "@prisma/client";
import { platformDb } from "@/lib/platform-db";
import { hashToken, minutesFromNow } from "@/lib/tokens";
import {
  isEmailDeliveryConfigured,
  normaliseEmail,
  sendTransactionalEmail,
} from "@/lib/transactional-email";

export { isEmailDeliveryConfigured } from "@/lib/transactional-email";

function createEmailCode() {
  return String(randomInt(100000, 1000000));
}

function safeHashEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function safeName(value: string) {
  return value.replace(/[<>&"']/g, "").slice(0, 120);
}

function safeDeliveryDetail(error: unknown) {
  return error instanceof Error ? error.message.replace(/[\r\n\t]+/g, " ").slice(0, 180) : "EMAIL_PROVIDER_ERROR";
}

export async function createBuyerEmailCode(input: {
  buyerId: string;
  email: string;
  name: string;
  minutes?: number;
}) {
  if (!isEmailDeliveryConfigured()) throw new Error("EMAIL_PROVIDER_NOT_CONFIGURED");
  const minutes = Math.max(5, Math.min(30, input.minutes ?? 10));
  const email = normaliseEmail(input.email);
  const code = createEmailCode();
  const codeHash = hashToken(code);
  const record = await platformDb.buyerEmailVerification.upsert({
    where: { buyerId: input.buyerId },
    update: {
      email,
      codeHash,
      expiresAt: minutesFromNow(minutes),
      attempts: 0,
      usedAt: null,
      verifiedAt: null,
      providerReference: "PENDING-DISPATCH",
      deliveryStatus: EmailDeliveryStatus.PENDING,
      deliveryDetail: null,
      deliveredAt: null,
    },
    create: {
      buyerId: input.buyerId,
      email,
      codeHash,
      expiresAt: minutesFromNow(minutes),
      providerReference: "PENDING-DISPATCH",
      deliveryStatus: EmailDeliveryStatus.PENDING,
    },
  });

  try {
    const sent = await sendTransactionalEmail({
      to: email,
      recipientName: input.name,
      subject: "Verify your Eugene Jersey Management email",
      text: `Hello ${input.name}, your email verification code is ${code}. It expires in ${minutes} minutes. Do not share it.`,
      html: `<p>Hello ${safeName(input.name)},</p><p>Your Eugene Jersey Management email verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>It expires in ${minutes} minutes. Do not share it.</p>`,
      idempotencyKey: `buyer-email-verification/${record.id}/${codeHash.slice(0, 20)}`,
      tags: { category: "buyer_email_verification", buyer_id: input.buyerId },
    });
    await platformDb.buyerEmailVerification.updateMany({
      where: { id: record.id, codeHash, usedAt: null },
      data: {
        providerReference: sent.providerReference,
        deliveryStatus: EmailDeliveryStatus.ACCEPTED,
        deliveryDetail: null,
      },
    });
  } catch (error) {
    await platformDb.buyerEmailVerification.updateMany({
      where: { id: record.id, codeHash, usedAt: null },
      data: {
        deliveryStatus: EmailDeliveryStatus.FAILED,
        deliveryDetail: safeDeliveryDetail(error),
      },
    });
    throw error;
  }

  return { email, expiresAt: record.expiresAt };
}

export async function consumeBuyerEmailCode(input: {
  buyerId: string;
  email: string;
  code: string;
}) {
  const email = normaliseEmail(input.email);
  const record = await platformDb.buyerEmailVerification.findUnique({ where: { buyerId: input.buyerId } });
  if (
    !record
    || record.email !== email
    || record.usedAt
    || record.expiresAt <= new Date()
    || record.attempts >= 5
    || record.deliveryStatus === EmailDeliveryStatus.FAILED
    || record.deliveryStatus === EmailDeliveryStatus.BOUNCED
  ) return null;

  if (!safeHashEqual(record.codeHash, hashToken(input.code))) {
    await platformDb.buyerEmailVerification.updateMany({
      where: { id: record.id, usedAt: null, attempts: { lt: 5 } },
      data: { attempts: { increment: 1 } },
    });
    return null;
  }

  const verifiedAt = new Date();
  const claimed = await platformDb.buyerEmailVerification.updateMany({
    where: {
      id: record.id,
      codeHash: record.codeHash,
      usedAt: null,
      expiresAt: { gt: verifiedAt },
      attempts: { lt: 5 },
      deliveryStatus: { notIn: [EmailDeliveryStatus.FAILED, EmailDeliveryStatus.BOUNCED] },
    },
    data: { usedAt: verifiedAt, verifiedAt },
  });
  return claimed.count === 1 ? { email, verifiedAt } : null;
}

export async function buyerEmailVerificationState(buyerId: string) {
  return platformDb.buyerEmailVerification.findUnique({
    where: { buyerId },
    select: {
      email: true,
      expiresAt: true,
      verifiedAt: true,
      attempts: true,
      deliveryStatus: true,
      deliveryDetail: true,
      deliveredAt: true,
    },
  });
}