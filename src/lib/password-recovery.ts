import "server-only";

import { randomInt, timingSafeEqual } from "node:crypto";
import {
  AccountKind,
  EmailDeliveryStatus,
  NotificationStatus,
  PasswordRecoveryChannel,
} from "@prisma/client";
import { isSmsDeliveryConfigured, sendDirectSms } from "@/lib/messaging";
import { normalizePhone } from "@/lib/phone";
import { platformDb } from "@/lib/platform-db";
import { createPlainToken, hashToken, minutesFromNow } from "@/lib/tokens";
import {
  isEmailDeliveryConfigured,
  normaliseEmail,
  sendTransactionalEmail,
} from "@/lib/transactional-email";

function createCode() {
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

function safeHtmlAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function safeDeliveryDetail(value: unknown) {
  return value instanceof Error
    ? value.message.replace(/[\r\n\t]+/g, " ").slice(0, 180)
    : String(value ?? "DELIVERY_ERROR").replace(/[\r\n\t]+/g, " ").slice(0, 180);
}

function normaliseDestination(channel: PasswordRecoveryChannel, value: string) {
  return channel === PasswordRecoveryChannel.EMAIL ? normaliseEmail(value) : normalizePhone(value);
}

function maskDestination(channel: PasswordRecoveryChannel, value: string) {
  if (channel === PasswordRecoveryChannel.EMAIL) {
    const [local, domain] = value.split("@");
    if (!domain) return "your email";
    const visible = local.slice(0, Math.min(2, local.length));
    return `${visible}${"•".repeat(Math.max(3, Math.min(8, local.length - visible.length)))}@${domain}`;
  }
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? `••••••${digits.slice(-4)}` : "your phone";
}

function recoveryLink(resetPath: string, publicToken: string) {
  const appUrl = process.env.APP_URL?.trim();
  if (!appUrl) throw new Error("APP_URL_NOT_CONFIGURED");
  const base = new URL(appUrl);
  const url = new URL(resetPath, base);
  if (url.origin !== base.origin) throw new Error("INVALID_RECOVERY_PATH");
  url.searchParams.set("challenge", publicToken);
  return url.toString();
}

export function recoveryChannelConfigured(channel: PasswordRecoveryChannel) {
  return channel === PasswordRecoveryChannel.EMAIL
    ? isEmailDeliveryConfigured()
    : isSmsDeliveryConfigured();
}

export async function createPasswordRecoveryChallenge(input: {
  accountKind: AccountKind;
  accountId: string;
  channel: PasswordRecoveryChannel;
  destination: string;
  recipientName: string;
  resetPath: string;
  minutes?: number;
}) {
  if (!recoveryChannelConfigured(input.channel)) throw new Error("RECOVERY_CHANNEL_NOT_CONFIGURED");
  const minutes = Math.max(5, Math.min(30, input.minutes ?? 10));
  const destination = normaliseDestination(input.channel, input.destination);
  const publicToken = createPlainToken();
  const code = createCode();
  const codeHash = hashToken(code);
  const link = recoveryLink(input.resetPath, publicToken);
  const now = new Date();

  await platformDb.passwordRecoveryChallenge.updateMany({
    where: {
      accountKind: input.accountKind,
      accountId: input.accountId,
      usedAt: null,
      expiresAt: { gt: now },
    },
    data: { usedAt: now, deliveryDetail: "Replaced by a newer recovery request." },
  });

  const challenge = await platformDb.passwordRecoveryChallenge.create({
    data: {
      publicTokenHash: hashToken(publicToken),
      accountKind: input.accountKind,
      accountId: input.accountId,
      channel: input.channel,
      destination,
      codeHash,
      expiresAt: minutesFromNow(minutes),
      providerReference: "PENDING-DISPATCH",
      deliveryStatus: EmailDeliveryStatus.PENDING,
    },
  });

  try {
    let providerReference: string;
    if (input.channel === PasswordRecoveryChannel.SMS) {
      const result = await sendDirectSms({
        recipientPhone: destination,
        recipientName: input.recipientName,
        body: `EJM password reset code: ${code}. Open ${link} and enter the code within ${minutes} minutes. Do not share it.`,
        metadata: { purpose: "password_recovery", accountKind: input.accountKind },
      });
      if (result.status !== NotificationStatus.SENT) throw new Error(result.providerReference ?? "SMS_NOT_ACCEPTED");
      providerReference = result.providerReference ?? "SMS-ACCEPTED";
    } else {
      const escapedLink = safeHtmlAttribute(link);
      const sent = await sendTransactionalEmail({
        to: destination,
        recipientName: input.recipientName,
        subject: "Reset your Eugene Jersey Management password",
        text: `Hello ${input.recipientName}, open ${link} and enter password reset code ${code}. The link and code expire in ${minutes} minutes. If you did not request this, ignore the message.`,
        html: `<p>Hello ${safeName(input.recipientName)},</p><p>Use the secure link below and enter this password reset code:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p><a href="${escapedLink}">Open secure password reset</a></p><p>The link and code expire in ${minutes} minutes. If you did not request this, ignore the message.</p>`,
        idempotencyKey: `password-recovery/${challenge.id}/${codeHash.slice(0, 20)}`,
        tags: { category: "password_recovery", account_kind: input.accountKind },
      });
      providerReference = sent.providerReference;
    }

    await platformDb.passwordRecoveryChallenge.updateMany({
      where: { id: challenge.id, codeHash, usedAt: null },
      data: {
        providerReference,
        deliveryStatus: EmailDeliveryStatus.ACCEPTED,
        deliveryDetail: null,
      },
    });
  } catch (error) {
    await platformDb.passwordRecoveryChallenge.updateMany({
      where: { id: challenge.id, codeHash, usedAt: null },
      data: {
        deliveryStatus: EmailDeliveryStatus.FAILED,
        deliveryDetail: safeDeliveryDetail(error),
      },
    });
    throw error;
  }

  return {
    publicToken,
    channel: input.channel,
    maskedDestination: maskDestination(input.channel, destination),
    expiresAt: challenge.expiresAt,
  };
}

export async function getPasswordRecoveryChallengeState(publicToken: string | null | undefined) {
  if (!publicToken || publicToken.length < 20) return null;
  const challenge = await platformDb.passwordRecoveryChallenge.findUnique({
    where: { publicTokenHash: hashToken(publicToken) },
    select: {
      channel: true,
      destination: true,
      expiresAt: true,
      attempts: true,
      usedAt: true,
      deliveryStatus: true,
    },
  });
  if (!challenge) return null;
  return {
    channel: challenge.channel,
    maskedDestination: maskDestination(challenge.channel, challenge.destination),
    expiresAt: challenge.expiresAt,
    attempts: challenge.attempts,
    usable: !challenge.usedAt
      && challenge.expiresAt > new Date()
      && challenge.attempts < 5
      && ![EmailDeliveryStatus.FAILED, EmailDeliveryStatus.BOUNCED].includes(challenge.deliveryStatus),
  };
}

export async function consumePasswordRecoveryChallenge(input: {
  publicToken: string;
  code: string;
}) {
  const tokenHash = hashToken(input.publicToken);
  const challenge = await platformDb.passwordRecoveryChallenge.findUnique({
    where: { publicTokenHash: tokenHash },
  });
  if (
    !challenge
    || challenge.usedAt
    || challenge.expiresAt <= new Date()
    || challenge.attempts >= 5
    || challenge.deliveryStatus === EmailDeliveryStatus.FAILED
    || challenge.deliveryStatus === EmailDeliveryStatus.BOUNCED
  ) return null;

  if (!safeHashEqual(challenge.codeHash, hashToken(input.code))) {
    await platformDb.passwordRecoveryChallenge.updateMany({
      where: { id: challenge.id, usedAt: null, attempts: { lt: 5 } },
      data: { attempts: { increment: 1 } },
    });
    return null;
  }

  const usedAt = new Date();
  const claimed = await platformDb.passwordRecoveryChallenge.updateMany({
    where: {
      id: challenge.id,
      publicTokenHash: tokenHash,
      codeHash: challenge.codeHash,
      usedAt: null,
      expiresAt: { gt: usedAt },
      attempts: { lt: 5 },
      deliveryStatus: { notIn: [EmailDeliveryStatus.FAILED, EmailDeliveryStatus.BOUNCED] },
    },
    data: { usedAt },
  });
  return claimed.count === 1 ? challenge : null;
}

export async function applyEmailDeliveryEvent(input: {
  providerReference: string;
  eventType: string;
  detail?: string | null;
  occurredAt: Date;
}) {
  const mapping: Record<string, EmailDeliveryStatus> = {
    "email.sent": EmailDeliveryStatus.ACCEPTED,
    "email.delivered": EmailDeliveryStatus.DELIVERED,
    "email.delivery_delayed": EmailDeliveryStatus.DELAYED,
    "email.bounced": EmailDeliveryStatus.BOUNCED,
    "email.failed": EmailDeliveryStatus.FAILED,
  };
  const deliveryStatus = mapping[input.eventType];
  if (!deliveryStatus) return;
  const deliveryDetail = input.detail?.replace(/[\r\n\t]+/g, " ").slice(0, 300) ?? null;
  const deliveredAt = deliveryStatus === EmailDeliveryStatus.DELIVERED ? input.occurredAt : undefined;

  await Promise.all([
    platformDb.passwordRecoveryChallenge.updateMany({
      where: { providerReference: input.providerReference, channel: PasswordRecoveryChannel.EMAIL },
      data: { deliveryStatus, deliveryDetail, ...(deliveredAt ? { deliveredAt } : {}) },
    }),
    platformDb.buyerEmailVerification.updateMany({
      where: { providerReference: input.providerReference },
      data: { deliveryStatus, deliveryDetail, ...(deliveredAt ? { deliveredAt } : {}) },
    }),
  ]);
}