"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { createPlainToken, hashToken, minutesFromNow } from "@/lib/tokens";

const schema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  role: z.nativeEnum(Role).refine((role) => role !== Role.SUPER_ADMIN),
});

export async function createInviteAction(formData: FormData) {
  const session = await requireRole(permissions.staff);
  if (!session.shopId) redirect("/login");

  const parsed = schema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) redirect("/dashboard/staff?error=invite");

  const token = createPlainToken();
  const invite = await prisma.inviteToken.create({
    data: {
      shopId: session.shopId,
      email: parsed.data.email,
      role: parsed.data.role,
      tokenHash: hashToken(token),
      expiresAt: minutesFromNow(60 * 24 * 7),
      createdById: session.id,
    },
  });

  await audit({
    shopId: session.shopId,
    userId: session.id,
    action: "staff.invite_created",
    entityType: "InviteToken",
    entityId: invite.id,
    metadata: { email: parsed.data.email, role: parsed.data.role },
  });

  console.log(`Invite link: ${process.env.APP_URL ?? "http://localhost:3000"}/invite/${token}`);
  revalidatePath("/dashboard/staff");
}
