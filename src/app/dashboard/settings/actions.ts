"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MediaKind, ShopVerificationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { createOptimizedMediaAsset } from "@/lib/media-storage";

function isManagedImageUrl(value: string) {
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  const mediaBase = process.env.MEDIA_PUBLIC_URL?.trim();
  if (!mediaBase) return false;
  try {
    const candidate = new URL(value);
    const base = new URL(mediaBase);
    const basePath = base.pathname.replace(/\/$/, "");
    return candidate.protocol === "https:"
      && candidate.origin === base.origin
      && candidate.pathname.startsWith(`${basePath}/`);
  } catch {
    return false;
  }
}

const safeImageUrl = z.string().trim().max(2000).refine(
  isManagedImageUrl,
  "Upload the logo or use a URL from the configured durable media host.",
);

const schema = z.object({
  name: z.string().trim().min(2).max(140),
  logoUrl: safeImageUrl.optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  cashOrderHoldMinutes: z.coerce.number().int().min(15).max(10080),
  settlementBank: z.string().trim().max(120).optional(),
  settlementAccount: z.string().trim().max(80).optional(),
  settlementAccountName: z.string().trim().max(160).optional(),
  shopMomoNumber: z.string().trim().max(30).optional(),
  shopMomoNetwork: z.string().trim().max(80).optional(),
  momoProvider: z.string().trim().max(80).optional(),
  allowCash: z.boolean().default(false),
  allowCard: z.boolean().default(false),
  allowMomo: z.boolean().default(false),
});

export async function updateShopSettingsAction(formData: FormData) {
  const session = await requireRole(permissions.settings);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  const shopId = session.shopId;
  const parsed = schema.safeParse({
    name: formData.get("name"), logoUrl: formData.get("logoUrl") || undefined,
    primaryColor: formData.get("primaryColor"), secondaryColor: formData.get("secondaryColor"),
    cashOrderHoldMinutes: formData.get("cashOrderHoldMinutes") || 120,
    settlementBank: formData.get("settlementBank") || undefined,
    settlementAccount: formData.get("settlementAccount") || undefined,
    settlementAccountName: formData.get("settlementAccountName") || undefined,
    shopMomoNumber: formData.get("shopMomoNumber") || undefined,
    shopMomoNetwork: formData.get("shopMomoNetwork") || undefined,
    momoProvider: formData.get("momoProvider") || undefined,
    allowCash: formData.get("allowCash") === "on", allowCard: formData.get("allowCard") === "on", allowMomo: formData.get("allowMomo") === "on",
  });
  if (!parsed.success) redirect("/dashboard/settings?error=invalid");

  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { isActive: true } });
  if (!shop?.isActive) redirect("/login?error=shop-suspended");

  const uploadedLogo = formData.get("logoFile");
  const logoAsset = uploadedLogo instanceof File && uploadedLogo.size > 0
    ? await createOptimizedMediaAsset({ file: uploadedLogo, shopId, uploadedById: session.id, kind: MediaKind.SHOP_LOGO })
    : null;

  await prisma.shop.update({
    where: { id: shopId },
    data: {
      name: parsed.data.name,
      logoUrl: logoAsset?.url ?? parsed.data.logoUrl,
      primaryColor: parsed.data.primaryColor,
      secondaryColor: parsed.data.secondaryColor,
      cashOrderHoldMinutes: parsed.data.cashOrderHoldMinutes,
      paymentConfig: {
        upsert: {
          create: {
            settlementBank: parsed.data.settlementBank,
            settlementAccount: parsed.data.settlementAccount,
            settlementAccountName: parsed.data.settlementAccountName,
            shopMomoNumber: parsed.data.shopMomoNumber,
            shopMomoNetwork: parsed.data.shopMomoNetwork,
            momoProvider: parsed.data.momoProvider,
            allowCash: parsed.data.allowCash,
            allowCard: parsed.data.allowCard,
            allowMomo: parsed.data.allowMomo,
          },
          update: {
            settlementBank: parsed.data.settlementBank,
            settlementAccount: parsed.data.settlementAccount,
            settlementAccountName: parsed.data.settlementAccountName,
            shopMomoNumber: parsed.data.shopMomoNumber,
            shopMomoNetwork: parsed.data.shopMomoNetwork,
            momoProvider: parsed.data.momoProvider,
            allowCash: parsed.data.allowCash,
            allowCard: parsed.data.allowCard,
            allowMomo: parsed.data.allowMomo,
          },
        },
      },
    },
  });
  await audit({
    shopId,
    userId: session.id,
    action: "settings.shop_updated",
    entityType: "Shop",
    entityId: shopId,
    metadata: {
      logoChanged: Boolean(logoAsset || parsed.data.logoUrl),
      settlementDetailsUpdated: Boolean(parsed.data.settlementBank || parsed.data.settlementAccount || parsed.data.settlementAccountName),
    },
  });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath("/shops");
}


const storefrontModeSchema = z.enum(["ONLINE", "BROWSE", "OFFLINE"]);

export async function updateStorefrontVisibilityAction(formData: FormData) {
  const session = await requireRole(permissions.settings);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  const mode = storefrontModeSchema.safeParse(formData.get("mode"));
  if (!mode.success) redirect("/dashboard/settings?error=storefront-mode");

  const shop = await prisma.shop.findUnique({
    where: { id: session.shopId },
    select: { id: true, slug: true, isActive: true, verificationStatus: true, storefrontEnabled: true, publicOrderingEnabled: true },
  });
  if (!shop?.isActive) redirect("/login?error=shop-suspended");
  if (mode.data !== "OFFLINE" && shop.verificationStatus !== ShopVerificationStatus.VERIFIED) {
    redirect("/dashboard/settings?error=verification-required");
  }

  const next = mode.data === "ONLINE"
    ? { storefrontEnabled: true, publicOrderingEnabled: true }
    : mode.data === "BROWSE"
      ? { storefrontEnabled: true, publicOrderingEnabled: false }
      : { storefrontEnabled: false, publicOrderingEnabled: false };

  await prisma.shop.update({ where: { id: shop.id }, data: next });
  await audit({
    shopId: shop.id,
    userId: session.id,
    action: "settings.storefront_visibility_updated",
    entityType: "Shop",
    entityId: shop.id,
    metadata: {
      mode: mode.data,
      previous: { storefrontEnabled: shop.storefrontEnabled, publicOrderingEnabled: shop.publicOrderingEnabled },
      next,
    },
  });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath("/shops");
  revalidatePath(`/shop/${shop.slug}`);
  redirect(`/dashboard/settings?storefront=${mode.data.toLowerCase()}`);
}
