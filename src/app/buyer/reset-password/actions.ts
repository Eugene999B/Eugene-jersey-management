"use server";

import { redirect } from "next/navigation";
import { AccountKind, PasswordRecoveryChannel } from "@prisma/client";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";
import { clearBuyerSessionCookie } from "@/lib/buyer-session";
import { prisma } from "@/lib/db";
import { strongPasswordSchema } from "@/lib/password-policy";
import { normalizePhone } from "@/lib/phone";
import { consumePasswordRecoveryChallenge } from "@/lib/password-recovery";
import { enforceRateLimit } from "@/lib/rate-limit";
import { hashToken } from "@/lib/tokens";
import { normaliseEmail } from "@/lib/transactional-email";

const schema = z.object({
  challenge: z.string().min(20).max(500),
  code: z.string().regex(/^\d{6}$/),
  password: strongPasswordSchema,
  next: z.string().max(500).optional(),
});

function safeNext(value: FormDataEntryValue | string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw.startsWith("/") || raw.startsWith("//") || /^https?:/i.test(raw)) return "/shops";
  return raw;
}

function errorRedirect(challenge: string, next: string) {
  redirect(`/buyer/reset-password?error=invalid&challenge=${encodeURIComponent(challenge)}&next=${encodeURIComponent(next)}`);
}

export async function resetBuyerPasswordAction(formData: FormData) {
  const challengeToken = String(formData.get("challenge") ?? "");
  const next = safeNext(formData.get("next"));
  const parsed = schema.safeParse({
    challenge: challengeToken,
    code: formData.get("code"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });
  if (!parsed.success) errorRedirect(challengeToken, next);

  try {
    await enforceRateLimit({
      key: `buyer-password-reset-verify:${hashToken(parsed.data.challenge).slice(0, 24)}`,
      limit: 8,
      windowSeconds: 15 * 60,
    });
  } catch {
    errorRedirect(parsed.data.challenge, next);
  }

  const challenge = await consumePasswordRecoveryChallenge({
    publicToken: parsed.data.challenge,
    code: parsed.data.code,
  });
  if (!challenge || challenge.accountKind !== AccountKind.BUYER) errorRedirect(parsed.data.challenge, next);

  const buyer = await prisma.buyerAccount.findFirst({
    where: { id: challenge.accountId, isActive: true },
  });
  if (!buyer) errorRedirect(parsed.data.challenge, next);

  const destinationStillMatches = challenge.channel === PasswordRecoveryChannel.EMAIL
    ? Boolean(buyer.email && normaliseEmail(buyer.email) === challenge.destination)
    : normalizePhone(buyer.phone) === challenge.destination;
  if (!destinationStillMatches) errorRedirect(parsed.data.challenge, next);

  await prisma.buyerAccount.update({
    where: { id: buyer.id },
    data: { passwordHash: await hashPassword(parsed.data.password) },
  });
  await clearBuyerSessionCookie();
  await audit({
    action: "auth.buyer_password_reset_completed",
    entityType: "BuyerAccount",
    entityId: buyer.id,
    metadata: { channel: challenge.channel },
  });
  redirect(`/buyer/login?reset=1&next=${encodeURIComponent(next)}`);
}