"use server";

import { redirect } from "next/navigation";
import { AccountKind, PasswordRecoveryChannel } from "@prisma/client";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { strongPasswordSchema } from "@/lib/password-policy";
import { consumePasswordRecoveryChallenge } from "@/lib/password-recovery";
import { enforceRateLimit } from "@/lib/rate-limit";
import { normalizePhone } from "@/lib/phone";
import { hashToken } from "@/lib/tokens";
import { normaliseEmail } from "@/lib/transactional-email";

const schema = z.object({
  challenge: z.string().min(20).max(500),
  code: z.string().regex(/^\d{6}$/),
  password: strongPasswordSchema,
});

function errorRedirect(challenge: string) {
  redirect(`/reset-password?error=invalid&challenge=${encodeURIComponent(challenge)}`);
}

export async function resetPasswordAction(formData: FormData) {
  const challengeToken = String(formData.get("challenge") ?? "");
  const parsed = schema.safeParse({
    challenge: challengeToken,
    code: formData.get("code"),
    password: formData.get("password"),
  });
  if (!parsed.success) errorRedirect(challengeToken);

  try {
    await enforceRateLimit({
      key: `staff-password-reset-verify:${hashToken(parsed.data.challenge).slice(0, 24)}`,
      limit: 8,
      windowSeconds: 15 * 60,
    });
  } catch {
    errorRedirect(parsed.data.challenge);
  }

  const challenge = await consumePasswordRecoveryChallenge({
    publicToken: parsed.data.challenge,
    code: parsed.data.code,
  });
  if (!challenge || challenge.accountKind !== AccountKind.USER) errorRedirect(parsed.data.challenge);

  const user = await prisma.user.findFirst({
    where: {
      id: challenge.accountId,
      isActive: true,
      OR: [{ shopId: null }, { shop: { isActive: true } }],
    },
  });
  if (!user) errorRedirect(parsed.data.challenge);

  const destinationStillMatches = challenge.channel === PasswordRecoveryChannel.EMAIL
    ? normaliseEmail(user.email) === challenge.destination
    : Boolean(user.phone && normalizePhone(user.phone) === challenge.destination);
  if (!destinationStillMatches) errorRedirect(parsed.data.challenge);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.password),
      failedLoginCount: 0,
      lockUntil: null,
      sessionVersion: { increment: 1 },
    },
  });
  await audit({
    shopId: user.shopId,
    userId: user.id,
    action: "auth.password_reset_completed",
    entityType: "User",
    entityId: user.id,
    metadata: { channel: challenge.channel },
  });
  redirect("/login?reset=1");
}