import { randomInt } from "crypto";
import { NotificationChannel, NotificationStatus, PhoneVerificationPurpose } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashToken, minutesFromNow } from "@/lib/tokens";
import { sendCustomerMessage, sendDirectSms } from "@/lib/messaging";
import { normalizePhone } from "@/lib/phone";

export function createNumericCode() {
  return String(randomInt(100000, 999999));
}

export async function createPhoneCode(input: {
  phone: string;
  purpose: PhoneVerificationPurpose;
  shopId?: string | null;
  userId?: string | null;
  buyerId?: string | null;
  name?: string | null;
  minutes?: number;
  pendingName?: string | null;
  pendingEmail?: string | null;
  pendingPasswordHash?: string | null;
}) {
  const code = createNumericCode();
  const phone = normalizePhone(input.phone);
  const record = await prisma.phoneVerificationCode.create({
    data: {
      userId: input.userId ?? null,
      buyerId: input.buyerId ?? null,
      phone,
      purpose: input.purpose,
      codeHash: hashToken(code),
      expiresAt: minutesFromNow(input.minutes ?? 10),
      pendingName: input.pendingName ?? null,
      pendingEmail: input.pendingEmail ?? null,
      pendingPasswordHash: input.pendingPasswordHash ?? null,
    },
  });

  try {
    const delivery = input.shopId ? await sendCustomerMessage({
      shopId: input.shopId,
      channel: NotificationChannel.SMS,
      recipientName: input.name,
      recipientPhone: phone,
      subject: "Verification code",
      body: `Your verification code is ${code}. It expires in ${input.minutes ?? 10} minutes.`,
      metadata: { purpose: input.purpose },
    }) : await sendDirectSms({
      recipientName: input.name,
      recipientPhone: phone,
      subject: "Verification code",
      body: `Your verification code is ${code}. It expires in ${input.minutes ?? 10} minutes.`,
      metadata: { purpose: input.purpose },
    });
    if (delivery.status !== NotificationStatus.SENT) throw new Error("SMS_DELIVERY_UNAVAILABLE");
  } catch (error) {
    await prisma.phoneVerificationCode.delete({ where: { id: record.id } }).catch(() => undefined);
    throw error;
  }

  return code;
}

export async function consumePhoneCode(input: {
  phone: string;
  purpose: PhoneVerificationPurpose;
  code: string;
  userId?: string | null;
  buyerId?: string | null;
}) {
  const record = await prisma.phoneVerificationCode.findFirst({
    where: {
      phone: normalizePhone(input.phone),
      purpose: input.purpose,
      usedAt: null,
      expiresAt: { gt: new Date() },
      userId: input.userId ?? undefined,
      buyerId: input.buyerId ?? undefined,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record || record.attempts >= 5) return null;

  if (record.codeHash !== hashToken(input.code)) {
    await prisma.phoneVerificationCode.updateMany({
      where: { id: record.id, usedAt: null },
      data: { attempts: { increment: 1 } },
    });
    return null;
  }

  const usedAt = new Date();
  const claimed = await prisma.phoneVerificationCode.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt },
  });
  return claimed.count === 1 ? { ...record, usedAt } : null;
}
