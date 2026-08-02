"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MediaKind, ShopVerificationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { requireBusinessModuleAccess } from "@/lib/business-module-access";
import { createOptimizedMediaAsset } from "@/lib/media-storage";
import { readShopProfileState, saveShopProfileBundle } from "@/lib/shop-profile-store";
import {
  buildLocationSearchText,
  canonicalGhanaRegion,
  cleanLocationText,
} from "@/lib/ghana-locations";

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
  "Upload the image or use a URL from the configured durable media host.",
);

const optionalText = (maximum: number) => z.preprocess(
  (value) => String(value ?? "").trim() || undefined,
  z.string().max(maximum).optional(),
);

const optionalCoordinate = (minimum: number, maximum: number) => z.preprocess(
  (value) => String(value ?? "").trim() || undefined,
  z.coerce.number().min(minimum).max(maximum).optional(),
);

const schema = z.object({
  name: z.string().trim().min(2).max(140),
  logoUrl: safeImageUrl.optional(),
  marketplaceTagline: optionalText(180),
  marketplaceHeroUrl: safeImageUrl.optional(),
  clearMarketplaceHero: z.boolean().default(false),
  region: optionalText(100),
  district: optionalText(180),
  city: optionalText(160),
  suburb: optionalText(160),
  digitalAddress: optionalText(40),
  address: optionalText(500),
  landmark: optionalText(700),
  latitude: optionalCoordinate(-90, 90),
  longitude: optionalCoordinate(-180, 180),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  cashOrderHoldMinutes: z.coerce.number().int().min(15).max(10080),
  settlementBank: optionalText(120),
  settlementAccount: optionalText(80),
  settlementAccountName: optionalText(160),
  shopMomoNumber: optionalText(30),
  shopMomoNetwork: optionalText(80),
  momoProvider: optionalText(80),
  allowCash: z.boolean().default(false),
  allowCard: z.boolean().default(false),
  allowMomo: z.boolean().default(false),
}).superRefine((value, context) => {
  const coreLocation = [value.region, value.district, value.city];
  const supplied = coreLocation.filter(Boolean).length;
  if (supplied > 0 && supplied < coreLocation.length) {
    context.addIssue({ code: "custom", path: ["region"], message: "Region, district and town must be completed together." });
  }
  if (value.region && !canonicalGhanaRegion(value.region)) {
    context.addIssue({ code: "custom", path: ["region"], message: "Choose one of Ghana's 16 regions." });
  }
});

export async function updateShopSettingsAction(formData: FormData) {
  const session = await requireRole(permissions.settings);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  const shopId = session.shopId;
  const parsed = schema.safeParse({
    name: formData.get("name"),
    logoUrl: formData.get("logoUrl") || undefined,
    marketplaceTagline: formData.get("marketplaceTagline"),
    marketplaceHeroUrl: formData.get("marketplaceHeroUrl") || undefined,
    clearMarketplaceHero: formData.get("clearMarketplaceHero") === "on",
    region: formData.get("region"),
    district: formData.get("district"),
    city: formData.get("city"),
    suburb: formData.get("suburb"),
    digitalAddress: formData.get("digitalAddress"),
    address: formData.get("address"),
    landmark: formData.get("landmark"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    primaryColor: formData.get("primaryColor"),
    secondaryColor: formData.get("secondaryColor"),
    cashOrderHoldMinutes: formData.get("cashOrderHoldMinutes") || 120,
    settlementBank: formData.get("settlementBank"),
    settlementAccount: formData.get("settlementAccount"),
    settlementAccountName: formData.get("settlementAccountName"),
    shopMomoNumber: formData.get("shopMomoNumber"),
    shopMomoNetwork: formData.get("shopMomoNetwork"),
    momoProvider: formData.get("momoProvider"),
    allowCash: formData.get("allowCash") === "on",
    allowCard: formData.get("allowCard") === "on",
    allowMomo: formData.get("allowMomo") === "on",
  });
  if (!parsed.success) redirect("/dashboard/settings?error=invalid");

  const [shop, currentMarketplaceProfile, currentLocation] = await readShopProfileState(shopId);
  if (!shop?.isActive) redirect("/login?error=shop-suspended");

  const uploadedLogo = formData.get("logoFile");
  const uploadedMarketplaceHero = formData.get("marketplaceHeroFile");
  const [logoAsset, marketplaceHeroAsset] = await Promise.all([
    uploadedLogo instanceof File && uploadedLogo.size > 0
      ? createOptimizedMediaAsset({ file: uploadedLogo, shopId, uploadedById: session.id, kind: MediaKind.SHOP_LOGO })
      : null,
    uploadedMarketplaceHero instanceof File && uploadedMarketplaceHero.size > 0
      ? createOptimizedMediaAsset({ file: uploadedMarketplaceHero, shopId, uploadedById: session.id, kind: MediaKind.PRODUCT })
      : null,
  ]);

  const marketplaceHeroUrl = parsed.data.clearMarketplaceHero
    ? null
    : marketplaceHeroAsset?.url
      ?? parsed.data.marketplaceHeroUrl
      ?? currentMarketplaceProfile?.heroImageUrl
      ?? null;
  const marketplaceTagline = parsed.data.marketplaceTagline ?? null;
  const region = parsed.data.region ? canonicalGhanaRegion(parsed.data.region) : null;
  const locationData = region && parsed.data.district && parsed.data.city
    ? {
        country: "Ghana",
        region,
        district: parsed.data.district,
        town: parsed.data.city,
        area: cleanLocationText(parsed.data.suburb, 160),
        digitalAddress: cleanLocationText(parsed.data.digitalAddress, 40)?.toUpperCase() ?? null,
        streetAddress: cleanLocationText(parsed.data.address, 500),
        landmark: cleanLocationText(parsed.data.landmark, 700),
        latitude: parsed.data.latitude ?? null,
        longitude: parsed.data.longitude ?? null,
        searchText: "",
      }
    : null;
  if (locationData) locationData.searchText = buildLocationSearchText(locationData);

  await saveShopProfileBundle({
    shopId,
    shopData: {
      name: parsed.data.name,
      logoUrl: logoAsset?.url ?? parsed.data.logoUrl,
      ...(locationData ? {
        city: locationData.town,
        country: locationData.country,
        credentialAddress: locationData.streetAddress,
      } : {}),
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
    marketplace: { tagline: marketplaceTagline, heroImageUrl: marketplaceHeroUrl },
    location: locationData,
  });

  await audit({
    shopId,
    userId: session.id,
    action: "settings.shop_updated",
    entityType: "Shop",
    entityId: shopId,
    metadata: {
      logoChanged: Boolean(logoAsset || parsed.data.logoUrl),
      marketplaceHeroChanged: Boolean(marketplaceHeroAsset || parsed.data.clearMarketplaceHero || parsed.data.marketplaceHeroUrl),
      marketplaceTaglineUpdated: marketplaceTagline !== currentMarketplaceProfile?.tagline,
      locationUpdated: Boolean(locationData && currentLocation?.searchText !== locationData.searchText),
      settlementDetailsUpdated: Boolean(parsed.data.settlementBank || parsed.data.settlementAccount || parsed.data.settlementAccountName),
    },
  });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath("/shops");
  revalidatePath(`/shop/${shop.slug}`);
}

const storefrontModeSchema = z.enum(["ONLINE", "BROWSE", "OFFLINE"]);

export async function updateStorefrontVisibilityAction(formData: FormData) {
  const session = await requireRole(permissions.settings);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  const mode = storefrontModeSchema.safeParse(formData.get("mode"));
  if (!mode.success) redirect("/dashboard/settings?error=storefront-mode");
  if (mode.data !== "OFFLINE") await requireBusinessModuleAccess(session.shopId, "ONLINE_SELLING");

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
