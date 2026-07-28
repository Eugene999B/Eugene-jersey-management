"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { getBuyerSession } from "@/lib/buyer-session";
import { consumeBuyerEmailCode, createBuyerEmailCode, isEmailDeliveryConfigured } from "@/lib/buyer-email-verification";
import { enforceRateLimit } from "@/lib/rate-limit";

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

const verifySchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/),
  next: z.string().max(500).optional(),
});

export async function resendBuyerEmailCodeAction(formData: FormData) {
  const buyer = await getBuyerSession();
  const next = safeNext(formData.get("next"));
  if (!buyer) redirect(`/buyer/login?error=login-required&next=${encodeURIComponent(next)}`);
  if (!buyer.email) redirect(`/buyer/verify-email?error=missing&next=${encodeURIComponent(next)}`);
  if (!isEmailDeliveryConfigured()) redirect(`/buyer/verify-email?error=provider&next=${encodeURIComponent(next)}`);

  try {
    await Promise.all([
      enforceRateLimit({ key: `buyer-email-code:${buyer.id}`, limit: 5, windowSeconds: 15 * 60 }),
      enforceRateLimit({ key: `buyer-email-code-ip:${await requestIp()}`, limit: 20, windowSeconds: 15 * 60 }),
    ]);
    await createBuyerEmailCode({ buyerId: buyer.id, email: buyer.email, name: buyer.name, minutes: 10 });
    await audit({
      action: "auth.buyer_email_verification_sent",
      entityType: "BuyerAccount",
      entityId: buyer.id,
      metadata: { emailDomain: buyer.email.split("@")[1] ?? "unknown" },
    });
  } catch {
    redirect(`/buyer/verify-email?error=send&next=${encodeURIComponent(next)}`);
  }
  redirect(`/buyer/verify-email?sent=1&next=${encodeURIComponent(next)}`);
}

export async function verifyBuyerEmailCodeAction(formData: FormData) {
  const buyer = await getBuyerSession();
  const parsed = verifySchema.safeParse({ code: formData.get("code"), next: formData.get("next") || undefined });
  const next = safeNext(formData.get("next"));
  if (!buyer) redirect(`/buyer/login?error=login-required&next=${encodeURIComponent(next)}`);
  if (!buyer.email) redirect(`/buyer/verify-email?error=missing&next=${encodeURIComponent(next)}`);
  if (!parsed.success) redirect(`/buyer/verify-email?error=invalid&next=${encodeURIComponent(next)}`);

  try {
    await Promise.all([
      enforceRateLimit({ key: `buyer-email-verify:${buyer.id}`, limit: 8, windowSeconds: 15 * 60 }),
      enforceRateLimit({ key: `buyer-email-verify-ip:${await requestIp()}`, limit: 30, windowSeconds: 15 * 60 }),
    ]);
  } catch {
    redirect(`/buyer/verify-email?error=rate&next=${encodeURIComponent(next)}`);
  }

  const verified = await consumeBuyerEmailCode({ buyerId: buyer.id, email: buyer.email, code: parsed.data.code });
  if (!verified) redirect(`/buyer/verify-email?error=code&next=${encodeURIComponent(next)}`);
  await audit({
    action: "auth.buyer_email_verified",
    entityType: "BuyerAccount",
    entityId: buyer.id,
    metadata: { emailDomain: buyer.email.split("@")[1] ?? "unknown" },
  });
  redirect(`/buyer/verify-email?verified=1&next=${encodeURIComponent(next)}`);
}
