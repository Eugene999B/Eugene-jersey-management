"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { strongPasswordSchema } from "@/lib/password-policy";
import { hashToken } from "@/lib/tokens";
import { assertInviteCanBeAccepted, SubscriptionLimitError } from "@/lib/subscription-entitlements";

const schema = z.object({
  token: z.string().min(20),
  name: z.string().trim().min(2).max(120),
  password: strongPasswordSchema,
});

export async function acceptInviteAction(formData: FormData) {
  const parsed = schema.safeParse({
    token: formData.get("token"),
    name: formData.get("name"),
    password: formData.get("password"),
  });
  if (!parsed.success) redirect("/login?error=invalid-invite");

  const invite = await prisma.inviteToken.findUnique({ where: { tokenHash: hashToken(parsed.data.token) } });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) redirect("/login?error=invalid-invite");
  const existing = await prisma.user.findUnique({ where: { email: invite.email }, select: { id: true } });
  if (existing) redirect("/login?error=invalid-invite");

  const passwordHash = await hashPassword(parsed.data.password);
  const outcome = await prisma.$transaction(async (tx) => {
    const claimed = await tx.inviteToken.updateMany({
      where: { id: invite.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) throw new Error("INVITE_ALREADY_USED");
    await assertInviteCanBeAccepted(tx, invite.shopId);
    return tx.user.create({
      data: {
        shopId: invite.shopId,
        email: invite.email,
        name: parsed.data.name,
        role: invite.role,
        passwordHash,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    .then((user) => ({ user, error: null as string | null }))
    .catch((error) => ({ user: null, error: error instanceof SubscriptionLimitError ? "plan-staff-limit" : "invalid-invite" }));
  if (!outcome.user) redirect(`/login?error=${outcome.error}`);

  await audit({
    shopId: invite.shopId,
    userId: outcome.user.id,
    action: "staff.invite_accepted",
    entityType: "User",
    entityId: outcome.user.id,
  });
  redirect("/login");
}
