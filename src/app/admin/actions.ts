"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { BillingCycle, PlanTier, Role, ShopVerificationStatus, SubscriptionStatus } from "@prisma/client";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/db";
import { hashPassword, requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";
import { audit } from "@/lib/audit";

const createShopSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(3).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  ownerName: z.string().min(2),
  ownerEmail: z.string().email().transform((value) => value.toLowerCase()),
  ownerPhone: z.string().optional(),
  staffLoginId: z.string().optional(),
  planTier: z.nativeEnum(PlanTier),
  billingCycle: z.nativeEnum(BillingCycle).default(BillingCycle.MONTHLY),
  monthlyPrice: z.coerce.number().min(0).optional(),
  yearlyPrice: z.coerce.number().min(0).optional(),
  legalBusinessName: z.string().optional(),
  businessRegistrationNumber: z.string().optional(),
  taxIdentificationNumber: z.string().optional(),
  ownerGovernmentId: z.string().optional(),
  credentialContactName: z.string().optional(),
  credentialPhone: z.string().optional(),
  credentialEmail: z.string().email().optional(),
  credentialAddress: z.string().optional(),
  credentialDocumentUrl: z.string().url().optional(),
});

function shopNetworkCode(slug: string) {
  const prefix = slug
    .split("-")
    .map((part) => part[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();

  return `${prefix || "SHOP"}-${nanoid(5).toUpperCase()}`;
}

function shopStaffLoginId(slug: string, provided?: string) {
  const clean = provided?.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (clean && clean.length >= 4) return clean;
  const prefix = slug
    .split("-")
    .map((part) => part[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();

  return `${prefix || "SHOP"}-STAFF-${nanoid(4).toUpperCase()}`;
}

export async function createShopAction(formData: FormData) {
  const session = await requireRole(permissions.superAdmin);
  const parsed = createShopSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    ownerName: formData.get("ownerName"),
    ownerEmail: formData.get("ownerEmail"),
    ownerPhone: formData.get("ownerPhone") || undefined,
    staffLoginId: formData.get("staffLoginId") || undefined,
    planTier: formData.get("planTier"),
    billingCycle: formData.get("billingCycle") || BillingCycle.MONTHLY,
    monthlyPrice: formData.get("monthlyPrice") || undefined,
    yearlyPrice: formData.get("yearlyPrice") || undefined,
    legalBusinessName: formData.get("legalBusinessName") || undefined,
    businessRegistrationNumber: formData.get("businessRegistrationNumber") || undefined,
    taxIdentificationNumber: formData.get("taxIdentificationNumber") || undefined,
    ownerGovernmentId: formData.get("ownerGovernmentId") || undefined,
    credentialContactName: formData.get("credentialContactName") || undefined,
    credentialPhone: formData.get("credentialPhone") || undefined,
    credentialEmail: formData.get("credentialEmail") || undefined,
    credentialAddress: formData.get("credentialAddress") || undefined,
    credentialDocumentUrl: formData.get("credentialDocumentUrl") || undefined,
  });

  if (!parsed.success) redirect("/admin/shops/new?error=invalid");

  const temporaryPassword = `Launch${Math.floor(100000 + Math.random() * 899999)}!`;
  const passwordHash = await hashPassword(temporaryPassword);

  const shop = await prisma.$transaction(async (tx) => {
    const createdShop = await tx.shop.create({
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        networkCode: shopNetworkCode(parsed.data.slug),
        staffLoginId: shopStaffLoginId(parsed.data.slug, parsed.data.staffLoginId),
        verificationStatus: ShopVerificationStatus.PENDING,
        planTier: parsed.data.planTier,
        billingCycle: parsed.data.billingCycle,
        monthlyPrice: parsed.data.monthlyPrice,
        yearlyPrice: parsed.data.yearlyPrice,
        subscriptionStatus: SubscriptionStatus.TRIAL,
        subscriptionRenewalAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        legalBusinessName: parsed.data.legalBusinessName,
        businessRegistrationNumber: parsed.data.businessRegistrationNumber,
        taxIdentificationNumber: parsed.data.taxIdentificationNumber,
        ownerGovernmentId: parsed.data.ownerGovernmentId,
        credentialContactName: parsed.data.credentialContactName || parsed.data.ownerName,
        credentialPhone: parsed.data.credentialPhone || parsed.data.ownerPhone,
        credentialEmail: parsed.data.credentialEmail || parsed.data.ownerEmail,
        credentialAddress: parsed.data.credentialAddress,
        credentialDocumentUrl: parsed.data.credentialDocumentUrl,
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
        phone: parsed.data.ownerPhone || parsed.data.credentialPhone,
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

export async function verifyShopCredentialsAction(formData: FormData) {
  const session = await requireRole(permissions.superAdmin);
  const shopId = String(formData.get("shopId") ?? "");
  if (!shopId) redirect("/admin");

  const shop = await prisma.shop.update({
    where: { id: shopId },
    data: {
      verificationStatus: ShopVerificationStatus.VERIFIED,
      verifiedAt: new Date(),
      verifiedById: session.id,
      isActive: true,
      storefrontEnabled: true,
    },
  });

  await audit({
    shopId,
    userId: session.id,
    action: "admin.shop_credentials_verified",
    entityType: "Shop",
    entityId: shopId,
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/shops/${shop.id}`);
}

export async function rejectShopCredentialsAction(formData: FormData) {
  const session = await requireRole(permissions.superAdmin);
  const shopId = String(formData.get("shopId") ?? "");
  if (!shopId) redirect("/admin");

  const shop = await prisma.shop.update({
    where: { id: shopId },
    data: {
      verificationStatus: ShopVerificationStatus.REJECTED,
      verifiedAt: null,
      verifiedById: null,
      storefrontEnabled: false,
    },
  });

  await audit({
    shopId,
    userId: session.id,
    action: "admin.shop_credentials_rejected",
    entityType: "Shop",
    entityId: shopId,
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/shops/${shop.id}`);
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

const subscriptionSchema = z.object({
  shopId: z.string().min(1),
  planTier: z.nativeEnum(PlanTier),
  billingCycle: z.nativeEnum(BillingCycle),
  subscriptionStatus: z.nativeEnum(SubscriptionStatus),
  monthlyPrice: z.coerce.number().min(0).optional(),
  yearlyPrice: z.coerce.number().min(0).optional(),
  subscriptionRenewalAt: z.coerce.date().optional(),
});

export async function updateShopSubscriptionAction(formData: FormData) {
  const session = await requireRole(permissions.superAdmin);
  const parsed = subscriptionSchema.safeParse({
    shopId: formData.get("shopId"),
    planTier: formData.get("planTier"),
    billingCycle: formData.get("billingCycle"),
    subscriptionStatus: formData.get("subscriptionStatus"),
    monthlyPrice: formData.get("monthlyPrice") || undefined,
    yearlyPrice: formData.get("yearlyPrice") || undefined,
    subscriptionRenewalAt: formData.get("subscriptionRenewalAt") || undefined,
  });

  if (!parsed.success) redirect("/admin?error=subscription");

  const shop = await prisma.shop.update({
    where: { id: parsed.data.shopId },
    data: {
      planTier: parsed.data.planTier,
      billingCycle: parsed.data.billingCycle,
      subscriptionStatus: parsed.data.subscriptionStatus,
      monthlyPrice: parsed.data.monthlyPrice,
      yearlyPrice: parsed.data.yearlyPrice,
      subscriptionRenewalAt: parsed.data.subscriptionRenewalAt,
    },
  });

  await audit({
    shopId: shop.id,
    userId: session.id,
    action: "admin.subscription_updated",
    entityType: "Shop",
    entityId: shop.id,
    metadata: {
      planTier: shop.planTier,
      billingCycle: shop.billingCycle,
      subscriptionStatus: shop.subscriptionStatus,
    },
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/shops/${shop.id}`);
}

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
