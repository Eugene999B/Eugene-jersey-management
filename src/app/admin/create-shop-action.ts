"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BillingCycle, PlanTier, Role, ShopVerificationStatus, SubscriptionStatus } from "@prisma/client";
import { nanoid } from "nanoid";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { strongPasswordSchema } from "@/lib/password-policy";
import { requirePlatformPermission } from "@/lib/platform-admin";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  ownerName: z.string().trim().min(2).max(120),
  ownerEmail: z.string().email().transform((value) => value.toLowerCase()),
  ownerPhone: z.string().trim().max(30).optional(),
  ownerPassword: strongPasswordSchema,
  staffLoginId: z.string().trim().max(40).optional(),
  planTier: z.nativeEnum(PlanTier),
  billingCycle: z.nativeEnum(BillingCycle).default(BillingCycle.MONTHLY),
  monthlyPrice: z.coerce.number().min(0).optional(),
  yearlyPrice: z.coerce.number().min(0).optional(),
  legalBusinessName: z.string().trim().max(160).optional(),
  businessRegistrationNumber: z.string().trim().max(80).optional(),
  taxIdentificationNumber: z.string().trim().max(80).optional(),
  ownerGovernmentId: z.string().trim().max(100).optional(),
  credentialContactName: z.string().trim().max(120).optional(),
  credentialPhone: z.string().trim().max(30).optional(),
  credentialEmail: z.string().email().optional(),
  credentialAddress: z.string().trim().max(500).optional(),
  credentialDocumentUrl: z.string().url().optional(),
});

function shopNetworkCode(slug: string) {
  const prefix = slug.split("-").map((part) => part[0]).join("").slice(0, 4).toUpperCase();
  return `${prefix || "SHOP"}-${nanoid(5).toUpperCase()}`;
}

function shopStaffLoginId(slug: string, provided?: string) {
  const clean = provided?.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (clean && clean.length >= 4) return clean;
  const prefix = slug.split("-").map((part) => part[0]).join("").slice(0, 4).toUpperCase();
  return `${prefix || "SHOP"}-STAFF-${nanoid(4).toUpperCase()}`;
}

export async function createSecureShopAction(formData: FormData) {
  const session = await requirePlatformPermission("shops");
  const parsed = schema.safeParse({
    name: formData.get("name"), slug: formData.get("slug"), ownerName: formData.get("ownerName"), ownerEmail: formData.get("ownerEmail"), ownerPhone: formData.get("ownerPhone") || undefined,
    ownerPassword: formData.get("ownerPassword"), staffLoginId: formData.get("staffLoginId") || undefined, planTier: formData.get("planTier"), billingCycle: formData.get("billingCycle") || BillingCycle.MONTHLY,
    monthlyPrice: formData.get("monthlyPrice") || undefined, yearlyPrice: formData.get("yearlyPrice") || undefined, legalBusinessName: formData.get("legalBusinessName") || undefined,
    businessRegistrationNumber: formData.get("businessRegistrationNumber") || undefined, taxIdentificationNumber: formData.get("taxIdentificationNumber") || undefined,
    ownerGovernmentId: formData.get("ownerGovernmentId") || undefined, credentialContactName: formData.get("credentialContactName") || undefined, credentialPhone: formData.get("credentialPhone") || undefined,
    credentialEmail: formData.get("credentialEmail") || undefined, credentialAddress: formData.get("credentialAddress") || undefined, credentialDocumentUrl: formData.get("credentialDocumentUrl") || undefined,
  });
  if (!parsed.success) redirect("/admin/shops/new?error=invalid");

  const proposedStaffLoginId = shopStaffLoginId(parsed.data.slug, parsed.data.staffLoginId);
  const [existingOwner, existingShop, existingLoginId] = await Promise.all([
    prisma.user.findUnique({ where: { email: parsed.data.ownerEmail }, select: { id: true } }),
    prisma.shop.findUnique({ where: { slug: parsed.data.slug }, select: { id: true } }),
    prisma.shop.findUnique({ where: { staffLoginId: proposedStaffLoginId }, select: { id: true } }),
  ]);
  if (existingOwner) redirect("/admin/shops/new?error=email-exists");
  if (existingShop) redirect("/admin/shops/new?error=slug-exists");
  if (existingLoginId) redirect("/admin/shops/new?error=login-id-exists");

  const passwordHash = await hashPassword(parsed.data.ownerPassword);
  const shop = await prisma.$transaction(async (tx) => {
    const createdShop = await tx.shop.create({
      data: {
        name: parsed.data.name, slug: parsed.data.slug, networkCode: shopNetworkCode(parsed.data.slug), staffLoginId: proposedStaffLoginId,
        verificationStatus: ShopVerificationStatus.PENDING, storefrontEnabled: false, publicOrderingEnabled: false, planTier: parsed.data.planTier,
        billingCycle: parsed.data.billingCycle, monthlyPrice: parsed.data.monthlyPrice, yearlyPrice: parsed.data.yearlyPrice, subscriptionStatus: SubscriptionStatus.TRIAL,
        subscriptionRenewalAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), legalBusinessName: parsed.data.legalBusinessName,
        businessRegistrationNumber: parsed.data.businessRegistrationNumber, taxIdentificationNumber: parsed.data.taxIdentificationNumber, ownerGovernmentId: parsed.data.ownerGovernmentId,
        credentialContactName: parsed.data.credentialContactName || parsed.data.ownerName, credentialPhone: parsed.data.credentialPhone || parsed.data.ownerPhone,
        credentialEmail: parsed.data.credentialEmail || parsed.data.ownerEmail, credentialAddress: parsed.data.credentialAddress, credentialDocumentUrl: parsed.data.credentialDocumentUrl,
        paymentConfig: { create: {} },
      },
    });
    await tx.user.create({ data: { shopId: createdShop.id, email: parsed.data.ownerEmail, name: parsed.data.ownerName, role: Role.OWNER, passwordHash, phone: parsed.data.ownerPhone || parsed.data.credentialPhone, isActive: true } });
    return createdShop;
  });

  await audit({ shopId: shop.id, userId: session.id, action: "admin.shop_created", entityType: "Shop", entityId: shop.id, metadata: { ownerEmail: parsed.data.ownerEmail, planTier: parsed.data.planTier, credentialDelivery: "out-of-band" } });
  revalidatePath("/admin");
  revalidatePath("/admin/shops");
  redirect(`/admin/shops/${shop.id}?created=1`);
}
