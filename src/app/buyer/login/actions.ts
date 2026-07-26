"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { PhoneVerificationPurpose } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createPhoneCode, consumePhoneCode } from "@/lib/phone-codes";
import { setBuyerSessionCookie } from "@/lib/buyer-session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { normalizePhone, phoneRateKey } from "@/lib/phone";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { isSmsDeliveryConfigured } from "@/lib/messaging";

const DUMMY_PASSWORD_HASH = "$2b$12$94A4bgZTq1kkieE.ysBmou2Q7M1Q7es6ib1sj4arKxG9fsC2iDZ3W";

const nextPath = (value: FormDataEntryValue | string | null | undefined) => {
  const raw = String(value ?? "").trim();
  if (!raw || raw.startsWith("//") || /^https?:/i.test(raw)) return "/shops";
  return raw.startsWith("/") ? raw : "/shops";
};

const requestSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().min(8).max(24),
  password: z.string().min(12).max(100),
  email: z.string().email().max(180).optional(),
  next: z.string().max(500).optional(),
});
const verifySchema = z.object({
  phone: z.string().min(8).max(24),
  code: z.string().regex(/^\d{6}$/),
  next: z.string().max(500).optional(),
});
const passwordLoginSchema = z.object({
  phone: z.string().min(8).max(24),
  password: z.string().min(1).max(200),
  next: z.string().max(500).optional(),
});

async function requestIp() {
  const requestHeaders = await headers();
  return requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    || requestHeaders.get("x-real-ip")
    || "unknown";
}

export async function requestBuyerLoginCodeAction(formData: FormData) {
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const parsed = requestSchema.safeParse({
    name: formData.get("name"),
    phone,
    password: formData.get("password"),
    email: formData.get("email") || undefined,
    next: formData.get("next") || undefined,
  });
  if (!parsed.success) redirect(`/buyer/login?error=invalid&next=${encodeURIComponent(nextPath(formData.get("next")))}`);
  if (!isSmsDeliveryConfigured()) redirect(`/buyer/login?error=sms&next=${encodeURIComponent(parsed.data.next || "/shops")}`);

  try {
    await Promise.all([
      enforceRateLimit({ key: `buyer-login-code:${phoneRateKey(parsed.data.phone)}`, limit: 5, windowSeconds: 15 * 60 }),
      enforceRateLimit({ key: `buyer-login-code-ip:${await requestIp()}`, limit: 20, windowSeconds: 15 * 60 }),
    ]);
  } catch {
    redirect(`/buyer/login?error=rate&phone=${encodeURIComponent(parsed.data.phone)}&next=${encodeURIComponent(parsed.data.next || "/shops")}`);
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const buyer = await prisma.buyerAccount.findUnique({ where: { phone: parsed.data.phone } });
  if (buyer && !buyer.isActive) redirect(`/buyer/login?error=invalid&next=${encodeURIComponent(parsed.data.next || "/shops")}`);

  try {
    await createPhoneCode({
      buyerId: buyer?.id,
      phone: parsed.data.phone,
      name: parsed.data.name,
      purpose: PhoneVerificationPurpose.BUYER_LOGIN,
      minutes: 10,
      pendingName: parsed.data.name,
      pendingEmail: parsed.data.email,
      pendingPasswordHash: passwordHash,
    });
  } catch {
    redirect(`/buyer/login?error=sms&phone=${encodeURIComponent(parsed.data.phone)}&next=${encodeURIComponent(parsed.data.next || "/shops")}`);
  }
  redirect(`/buyer/login?sent=1&phone=${encodeURIComponent(parsed.data.phone)}&next=${encodeURIComponent(parsed.data.next || "/shops")}`);
}

export async function buyerPasswordLoginAction(formData: FormData) {
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const parsed = passwordLoginSchema.safeParse({
    phone,
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });
  if (!parsed.success) redirect(`/buyer/login?error=invalid&next=${encodeURIComponent(nextPath(formData.get("next")))}`);

  try {
    await Promise.all([
      enforceRateLimit({ key: `buyer-password-login:${phoneRateKey(parsed.data.phone)}`, limit: 8, windowSeconds: 15 * 60 }),
      enforceRateLimit({ key: `buyer-password-login-ip:${await requestIp()}`, limit: 40, windowSeconds: 15 * 60 }),
    ]);
  } catch {
    redirect(`/buyer/login?error=rate&phone=${encodeURIComponent(parsed.data.phone)}&next=${encodeURIComponent(parsed.data.next || "/shops")}`);
  }

  const buyer = await prisma.buyerAccount.findUnique({ where: { phone: parsed.data.phone } });
  const validPassword = await verifyPassword(parsed.data.password, buyer?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!buyer || !buyer.isActive || !buyer.passwordHash || !validPassword) {
    redirect(`/buyer/login?error=invalid&phone=${encodeURIComponent(parsed.data.phone)}&next=${encodeURIComponent(parsed.data.next || "/shops")}`);
  }

  const updated = await prisma.buyerAccount.update({ where: { id: buyer.id }, data: { lastLoginAt: new Date() } });
  await setBuyerSessionCookie({
    id: updated.id,
    phone: updated.phone,
    email: updated.email,
    name: updated.name,
    sessionVersion: updated.updatedAt.getTime(),
  });
  redirect(nextPath(parsed.data.next));
}

export async function verifyBuyerLoginCodeAction(formData: FormData) {
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const parsed = verifySchema.safeParse({
    phone,
    code: formData.get("code"),
    next: formData.get("next") || undefined,
  });
  if (!parsed.success) redirect("/buyer/login?error=invalid");

  try {
    await Promise.all([
      enforceRateLimit({ key: `buyer-login-verify:${phoneRateKey(parsed.data.phone)}`, limit: 8, windowSeconds: 15 * 60 }),
      enforceRateLimit({ key: `buyer-login-verify-ip:${await requestIp()}`, limit: 30, windowSeconds: 15 * 60 }),
    ]);
  } catch {
    redirect(`/buyer/login?error=rate&phone=${encodeURIComponent(parsed.data.phone)}&next=${encodeURIComponent(parsed.data.next || "/shops")}`);
  }

  const existingBuyer = await prisma.buyerAccount.findUnique({ where: { phone: parsed.data.phone } });
  if (existingBuyer && !existingBuyer.isActive) redirect(`/buyer/login?error=invalid&phone=${encodeURIComponent(parsed.data.phone)}`);

  const consumed = await consumePhoneCode({
    buyerId: existingBuyer?.id,
    phone: parsed.data.phone,
    purpose: PhoneVerificationPurpose.BUYER_LOGIN,
    code: parsed.data.code,
  });
  if (!consumed?.pendingPasswordHash || !consumed.pendingName) redirect(`/buyer/login?error=code&phone=${encodeURIComponent(parsed.data.phone)}&next=${encodeURIComponent(parsed.data.next || "/shops")}`);

  const emailOwner = consumed.pendingEmail
    ? await prisma.buyerAccount.findUnique({ where: { email: consumed.pendingEmail } })
    : null;
  if (emailOwner && emailOwner.id !== existingBuyer?.id) redirect(`/buyer/login?error=email&phone=${encodeURIComponent(parsed.data.phone)}`);

  const updated = existingBuyer
    ? await prisma.buyerAccount.update({
        where: { id: existingBuyer.id },
        data: {
          name: consumed.pendingName,
          email: consumed.pendingEmail,
          passwordHash: consumed.pendingPasswordHash,
          phoneVerifiedAt: new Date(),
          lastLoginAt: new Date(),
        },
      })
    : await prisma.buyerAccount.create({
        data: {
          name: consumed.pendingName,
          phone: parsed.data.phone,
          email: consumed.pendingEmail,
          passwordHash: consumed.pendingPasswordHash,
          phoneVerifiedAt: new Date(),
          lastLoginAt: new Date(),
        },
      });

  await setBuyerSessionCookie({
    id: updated.id,
    phone: updated.phone,
    email: updated.email,
    name: updated.name,
    sessionVersion: updated.updatedAt.getTime(),
  });
  redirect(nextPath(parsed.data.next));
}
