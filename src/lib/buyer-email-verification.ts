import "server-only";

import { randomInt, timingSafeEqual } from "node:crypto";
import { platformDb } from "@/lib/platform-db";
import { hashToken, minutesFromNow } from "@/lib/tokens";

const EMAIL_TIMEOUT_MS = Math.max(3_000, Math.min(30_000, Number(process.env.EMAIL_PROVIDER_TIMEOUT_MS ?? 12_000)));

function normaliseEmail(value: string) {
  return value.trim().toLowerCase();
}

function createEmailCode() {
  return String(randomInt(100000, 1000000));
}

function safeHashEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function emailConfig() {
  return {
    provider: (process.env.EMAIL_PROVIDER ?? "console").trim().toLowerCase(),
    apiKey: process.env.RESEND_API_KEY?.trim(),
    from: process.env.EMAIL_FROM?.trim(),
  };
}

export function isEmailDeliveryConfigured() {
  const config = emailConfig();
  return config.provider === "resend" && Boolean(config.apiKey && config.from);
}

async function sendViaResend(input: {
  recordId: string;
  codeHash: string;
  email: string;
  name: string;
  code: string;
  minutes: number;
}) {
  const config = emailConfig();
  if (config.provider !== "resend" || !config.apiKey || !config.from) {
    throw new Error("EMAIL_PROVIDER_NOT_CONFIGURED");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `buyer-email-verification/${input.recordId}/${input.codeHash.slice(0, 20)}`,
      "User-Agent": "Eugene-Jersey-Management/1.0",
    },
    body: JSON.stringify({
      from: config.from,
      to: [input.email],
      subject: "Verify your Eugene Jersey Management email",
      text: `Hello ${input.name}, your email verification code is ${input.code}. It expires in ${input.minutes} minutes. Do not share it.`,
      html: `<p>Hello ${input.name.replace(/[<>&"']/g, "")},</p><p>Your Eugene Jersey Management email verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${input.code}</p><p>It expires in ${input.minutes} minutes. Do not share it.</p>`,
    }),
    signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as { id?: string; message?: string } | null;
  if (!response.ok || !payload?.id) throw new Error(`EMAIL_PROVIDER_${response.status}`);
  return payload.id;
}

export async function createBuyerEmailCode(input: {
  buyerId: string;
  email: string;
  name: string;
  minutes?: number;
}) {
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
    },
    create: {
      buyerId: input.buyerId,
      email,
      codeHash,
      expiresAt: minutesFromNow(minutes),
      providerReference: "PENDING-DISPATCH",
    },
  });

  try {
    const providerReference = await sendViaResend({
      recordId: record.id,
      codeHash,
      email,
      name: input.name,
      code,
      minutes,
    });
    await platformDb.buyerEmailVerification.updateMany({
      where: { id: record.id, codeHash, usedAt: null },
      data: { providerReference },
    });
  } catch (error) {
    await platformDb.buyerEmailVerification.deleteMany({ where: { id: record.id, codeHash } });
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
  if (!record || record.email !== email || record.usedAt || record.expiresAt <= new Date() || record.attempts >= 5) return null;

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
    },
    data: { usedAt: verifiedAt, verifiedAt },
  });
  return claimed.count === 1 ? { email, verifiedAt } : null;
}

export async function buyerEmailVerificationState(buyerId: string) {
  return platformDb.buyerEmailVerification.findUnique({
    where: { buyerId },
    select: { email: true, expiresAt: true, verifiedAt: true, attempts: true },
  });
}
