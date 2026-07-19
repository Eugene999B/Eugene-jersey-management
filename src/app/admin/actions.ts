"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PlanTier, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword, requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";
import { audit } from "@/lib/audit";

const createShopSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(3).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  ownerName: z.string().min(2),
  ownerEmail: z.string().email().transform((value) => value.toLowerCase()),
  planTier: z.nativeEnum(PlanTier),
});

export async function createShopAction(formData: FormData) {
  const session = await requireRole(permissions.superAdmin);
  const parsed = createShopSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    ownerName: formData.get("ownerName"),
    ownerEmail: formData.get("ownerEmail"),
    planTier: formData.get("planTier"),
  });

  if (!parsed.success) redirect("/admin/shops/new?error=invalid");

  const temporaryPassword = `Launch${Math.floor(100000 + Math.random() * 899999)}!`;
  const passwordHash = await hashPassword(temporaryPassword);

  const shop = await prisma.$transaction(async (tx) => {
    const createdShop = await tx.shop.create({
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        planTier: parsed.data.planTier,
        paymentConfig: { create: {} },
      },
    });

    await tx.user.create({
      data: {
        shopId: createdShop.id,
        email: parsed.data.ownerEmail,
        name: parsed.data.ownerName,
        role: Role.OWNER,
        passwordHash,
      },
    });

    return createdShop;
  });

  console.log(`Initial owner password for ${parsed.data.ownerEmail}: ${temporaryPassword}`);
  await audit({
    shopId: shop.id,
    userId: session.id,
    action: "admin.shop_created",
    entityType: "Shop",
    entityId: shop.id,
    metadata: { ownerEmail: parsed.data.ownerEmail, planTier: parsed.data.planTier },
  });

  revalidatePath("/admin");
  redirect(`/admin/shops/${shop.id}`);
}

export async function toggleShopAction(formData: FormData) {
  const session = await requireRole(permissions.superAdmin);
  const shopId = String(formData.get("shopId") ?? "");
  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: shopId } });

  const updated = await prisma.shop.update({
    where: { id: shopId },
    data: { isActive: !shop.isActive },
  });

  await audit({
    shopId,
    userId: session.id,
    action: updated.isActive ? "admin.shop_reactivated" : "admin.shop_suspended",
    entityType: "Shop",
    entityId: shopId,
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/shops/${shopId}`);
}

const announcementSchema = z.object({
  title: z.string().min(2),
  body: z.string().min(2),
});

export async function createGlobalAnnouncementAction(formData: FormData) {
  const session = await requireRole(permissions.superAdmin);
  const parsed = announcementSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) redirect("/admin?error=announcement");

  const announcement = await prisma.announcement.create({
    data: {
      ...parsed.data,
      isGlobal: true,
    },
  });

  await audit({
    userId: session.id,
    action: "admin.global_announcement_created",
    entityType: "Announcement",
    entityId: announcement.id,
  });

  revalidatePath("/admin");
}
