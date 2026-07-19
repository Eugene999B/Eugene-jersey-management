import { randomInt } from "crypto";
import { NotificationChannel, PhoneVerificationPurpose } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashToken, minutesFromNow } from "@/lib/tokens";
import { sendCustomerMessage, sendDirectSms } from "@/lib/messaging";

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
}) {
  const code = createNumericCode();
  await prisma.phoneVerificationCode.create({
    data: {
      userId: input.userId ?? null,
      buyerId: input.buyerId ?? null,
      phone: input.phone,
      purpose: input.purpose,
      codeHash: hashToken(code),
      expiresAt: minutesFromNow(input.minutes ?? 10),
    },
  });

  if (input.shopId) {
    await sendCustomerMessage({
      shopId: input.shopId,
      channel: NotificationChannel.SMS,
      recipientName: input.name,
      recipientPhone: input.phone,
      subject: "Verification code",
      body: `Your verification code is ${code}. It expires in ${input.minutes ?? 10} minutes.`,
      metadata: { purpose: input.purpose },
    });
  } else {
    await sendDirectSms({
      recipientName: input.name,
      recipientPhone: input.phone,
      subject: "Verification code",
      body: `Your verification code is ${code}. It expires in ${input.minutes ?? 10} minutes.`,
      metadata: { purpose: input.purpose },
    });
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
      phone: input.phone,
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
    await prisma.phoneVerificationCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return null;
  }

  return prisma.phoneVerificationCode.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });
}
