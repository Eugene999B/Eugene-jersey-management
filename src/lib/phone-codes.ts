import { randomInt, timingSafeEqual } from "crypto";
import { NotificationStatus, PhoneVerificationPurpose } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashToken, minutesFromNow } from "@/lib/tokens";
import { sendDirectSms } from "@/lib/messaging";
import { normalizePhone } from "@/lib/phone";

export function createNumericCode() {
  return String(randomInt(100000, 1000000));
}

function safeHashEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
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
  const now = new Date();

  await prisma.phoneVerificationCode.deleteMany({
    where: {
      phone,
      purpose: input.purpose,
      usedAt: null,
      OR: [
        { expiresAt: { lte: now } },
        { userId: input.userId ?? undefined, buyerId: input.buyerId ?? undefined },
      ],
    },
  });

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
    // Security codes bypass CustomerMessage storage. Only the provider receives the
    // plaintext code, preventing OTPs from appearing in dashboards and exports.
    const delivery = await sendDirectSms({
      recipientName: input.name,
      recipientPhone: phone,
      subject: "Verification code",
      body: `Your verification code is ${code}. It expires in ${input.minutes ?? 10} minutes. Do not share it.`,
      metadata: { purpose: input.purpose, securityMessage: true },
    });
    if (delivery.status !== NotificationStatus.SENT) throw new Error("SMS_DELIVERY_UNAVAILABLE");
  } catch (error) {
    await prisma.phoneVerificationCode.delete({ where: { id: record.id } }).catch(() => undefined);
    throw error;
  }

  return { expiresAt: record.expiresAt };
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

  if (!safeHashEqual(record.codeHash, hashToken(input.code))) {
    await prisma.phoneVerificationCode.updateMany({
      where: { id: record.id, usedAt: null, attempts: { lt: 5 } },
      data: { attempts: { increment: 1 } },
    });
    return null;
  }

  const usedAt = new Date();
  const claimed = await prisma.phoneVerificationCode.updateMany({
    where: { id: record.id, usedAt: null, expiresAt: { gt: usedAt }, attempts: { lt: 5 } },
    data: { usedAt },
  });
  return claimed.count === 1 ? { ...record, usedAt } : null;
}
