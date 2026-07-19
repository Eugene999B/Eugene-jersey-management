"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { hashToken } from "@/lib/tokens";

const schema = z.object({
  token: z.string().min(20),
  name: z.string().min(2),
  password: z.string().min(8),
});

export async function acceptInviteAction(formData: FormData) {
  const parsed = schema.safeParse({
    token: formData.get("token"),
    name: formData.get("name"),
    password: formData.get("password"),
  });

  if (!parsed.success) redirect("/login?error=invalid-invite");

  const invite = await prisma.inviteToken.findUnique({
    where: { tokenHash: hashToken(parsed.data.token) },
  });

  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    redirect("/login?error=invalid-invite");
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.upsert({
      where: { email: invite.email },
      update: {
        shopId: invite.shopId,
        name: parsed.data.name,
        role: invite.role,
        passwordHash,
        isActive: true,
      },
      create: {
        shopId: invite.shopId,
        email: invite.email,
        name: parsed.data.name,
        role: invite.role,
        passwordHash,
      },
    });

    await tx.inviteToken.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });

    return createdUser;
  });

  await audit({
    shopId: invite.shopId,
    userId: user.id,
    action: "staff.invite_accepted",
    entityType: "User",
    entityId: user.id,
  });

  redirect("/login");
}
