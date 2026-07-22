"use server";

import { redirect } from "next/navigation";
import { PhoneVerificationPurpose } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createPhoneCode, consumePhoneCode } from "@/lib/phone-codes";
import { setBuyerSessionCookie } from "@/lib/buyer-session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { normalizePhone, phoneRateKey } from "@/lib/phone";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { isSmsDeliveryConfigured } from "@/lib/messaging";

const nextPath = (value: FormDataEntryValue | null) => {
  const raw = String(value ?? "").trim();
  if (!raw || raw.startsWith("//") || raw.startsWith("http")) return "/shops";
  return raw.startsWith("/") ? raw : "/shops";
};

const requestSchema = z.object({
  name: z.string().min(2).max(80),
  phone: z.string().min(8).max(24),
  password: z.string().min(8).max(80),
  email: z.string().email().optional(),
  next: z.string().optional(),
});

const verifySchema = z.object({
  phone: z.string().min(8).max(24),
  code: z.string().min(4).max(8),
  next: z.string().optional(),
});

const passwordLoginSchema = z.object({
  phone: z.string().min(8).max(24),
  password: z.string().min(1),
  next: z.string().optional(),
});

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
    await enforceRateLimit({
      key: `buyer-login-code:${phoneRateKey(parsed.data.phone)}`,
      limit: 5,
      windowSeconds: 15 * 60,
    });
  } catch {
    redirect(`/buyer/login?error=rate&phone=${encodeURIComponent(parsed.data.phone)}&next=${encodeURIComponent(parsed.data.next || "/shops")}`);
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const buyer = await prisma.buyerAccount.findUnique({ where: { phone: parsed.data.phone } });
  if (buyer && !buyer.isActive) {
    redirect(`/buyer/login?error=invalid&next=${encodeURIComponent(parsed.data.next || "/shops")}`);
  }

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
    await enforceRateLimit({
      key: `buyer-password-login:${phoneRateKey(parsed.data.phone)}`,
      limit: 8,
      windowSeconds: 15 * 60,
    });
  } catch {
    redirect(`/buyer/login?error=rate&phone=${encodeURIComponent(parsed.data.phone)}&next=${encodeURIComponent(parsed.data.next || "/shops")}`);
  }

  const buyer = await prisma.buyerAccount.findUnique({ where: { phone: parsed.data.phone } });
  const validPassword = buyer?.passwordHash ? await verifyPassword(parsed.data.password, buyer.passwordHash) : false;
  if (!buyer || !buyer.isActive || !validPassword) {
    redirect(`/buyer/login?error=invalid&phone=${encodeURIComponent(parsed.data.phone)}&next=${encodeURIComponent(parsed.data.next || "/shops")}`);
  }

  const updated = await prisma.buyerAccount.update({
    where: { id: buyer.id },
    data: { lastLoginAt: new Date() },
  });

  await setBuyerSessionCookie({
    id: updated.id,
    phone: updated.phone,
    email: updated.email,
    name: updated.name,
  });

  redirect(nextPath(parsed.data.next ?? null));
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
    await enforceRateLimit({
      key: `buyer-login-verify:${phoneRateKey(parsed.data.phone)}`,
      limit: 8,
      windowSeconds: 15 * 60,
    });
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
  if (emailOwner && emailOwner.id !== existingBuyer?.id) {
    redirect(`/buyer/login?error=email&phone=${encodeURIComponent(parsed.data.phone)}`);
  }

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
  });

  redirect(nextPath(parsed.data.next ?? null));
}
