"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";
import { audit } from "@/lib/audit";

const schema = z.object({
  name: z.string().min(2),
  logoUrl: z.string().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export async function updateShopSettingsAction(formData: FormData) {
  const session = await requireRole(permissions.settings);
  if (!session.shopId) redirect("/login");

  const parsed = schema.safeParse({
    name: formData.get("name"),
    logoUrl: formData.get("logoUrl") || undefined,
    primaryColor: formData.get("primaryColor"),
    secondaryColor: formData.get("secondaryColor"),
  });

  if (!parsed.success) redirect("/dashboard/settings?error=invalid");

  await prisma.shop.update({
    where: { id: session.shopId },
    data: parsed.data,
  });

  await audit({
    shopId: session.shopId,
    userId: session.id,
    action: "settings.shop_updated",
    entityType: "Shop",
    entityId: session.shopId,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
}
