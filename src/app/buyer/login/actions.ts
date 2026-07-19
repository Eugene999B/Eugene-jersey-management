"use server";

import { redirect } from "next/navigation";
import { PhoneVerificationPurpose } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createPhoneCode, consumePhoneCode } from "@/lib/phone-codes";
import { setBuyerSessionCookie } from "@/lib/buyer-session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { normalizePhone, phoneRateKey } from "@/lib/phone";

const nextPath = (value: FormDataEntryValue | null) => {
  const raw = String(value ?? "").trim();
  if (!raw || raw.startsWith("//") || raw.startsWith("http")) return "/shops";
  return raw.startsWith("/") ? raw : "/shops";
};

const requestSchema = z.object({
  name: z.string().min(2).max(80),
  phone: z.string().min(8).max(24),
  email: z.string().email().optional(),
  next: z.string().optional(),
});

const verifySchema = z.object({
  phone: z.string().min(8).max(24),
  code: z.string().min(4).max(8),
  next: z.string().optional(),
});

export async function requestBuyerLoginCodeAction(formData: FormData) {
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const parsed = requestSchema.safeParse({
    name: formData.get("name"),
    phone,
    email: formData.get("email") || undefined,
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) redirect(`/buyer/login?error=invalid&next=${encodeURIComponent(nextPath(formData.get("next")))}`);

  try {
    await enforceRateLimit({
      key: `buyer-login-code:${phoneRateKey(parsed.data.phone)}`,
      limit: 5,
      windowSeconds: 15 * 60,
    });
  } catch {
    redirect(`/buyer/login?error=rate&phone=${encodeURIComponent(parsed.data.phone)}&next=${encodeURIComponent(parsed.data.next || "/shops")}`);
  }

  const buyer = await prisma.buyerAccount.upsert({
    where: { phone: parsed.data.phone },
    update: {
      name: parsed.data.name,
      email: parsed.data.email,
      isActive: true,
    },
    create: {
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email,
    },
  });

  await createPhoneCode({
    buyerId: buyer.id,
    phone: buyer.phone,
    name: buyer.name,
    purpose: PhoneVerificationPurpose.BUYER_LOGIN,
    minutes: 10,
  });

  redirect(`/buyer/login?sent=1&phone=${encodeURIComponent(buyer.phone)}&next=${encodeURIComponent(parsed.data.next || "/shops")}`);
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

  const buyer = await prisma.buyerAccount.findUnique({ where: { phone: parsed.data.phone } });
  if (!buyer || !buyer.isActive) redirect(`/buyer/login?error=invalid&phone=${encodeURIComponent(parsed.data.phone)}`);

  const consumed = await consumePhoneCode({
    buyerId: buyer.id,
    phone: buyer.phone,
    purpose: PhoneVerificationPurpose.BUYER_LOGIN,
    code: parsed.data.code,
  });

  if (!consumed) redirect(`/buyer/login?error=code&phone=${encodeURIComponent(buyer.phone)}&next=${encodeURIComponent(parsed.data.next || "/shops")}`);

  const updated = await prisma.buyerAccount.update({
    where: { id: buyer.id },
    data: { phoneVerifiedAt: new Date(), lastLoginAt: new Date() },
  });

  await setBuyerSessionCookie({
    id: updated.id,
    phone: updated.phone,
    email: updated.email,
    name: updated.name,
  });

  redirect(nextPath(parsed.data.next ?? null));
}
