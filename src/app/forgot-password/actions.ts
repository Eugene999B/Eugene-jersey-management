"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createPlainToken, hashToken, minutesFromNow } from "@/lib/tokens";
import { audit } from "@/lib/audit";

const schema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
});

export async function requestPasswordResetAction(formData: FormData) {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) redirect("/forgot-password?sent=1");

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (user) {
    const token = createPlainToken();
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: minutesFromNow(30),
      },
    });
    await audit({
      shopId: user.shopId,
      userId: user.id,
      action: "auth.password_reset_requested",
      entityType: "User",
      entityId: user.id,
    });
    console.log(`Password reset link: ${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${token}`);
  }

  redirect("/forgot-password?sent=1");
}
