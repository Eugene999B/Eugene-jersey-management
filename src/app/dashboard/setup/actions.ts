"use server";

import { BusinessType, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { businessModuleEnabled } from "@/lib/business-modules";
import { buildLocationSearchText, canonicalGhanaRegion, cleanLocationText } from "@/lib/ghana-locations";
import { prisma } from "@/lib/db";
import { permissions } from "@/lib/rbac";

const optionalText = (maximum: number) => z.preprocess(
  (value) => String(value ?? "").trim() || undefined,
  z.string().max(maximum).optional(),
);

async function onboardingSession() {
  const session = await requireRole(permissions.settings);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  return { session, shopId: session.shopId };
}

async function markStep(input: {
  shopId: string;
  userId: string;
  step: number;
  action: string;
  data?: Prisma.ShopUpdateInput;
  metadata?: Record<string, unknown>;
}) {
  const shop = await prisma.shop.findFirst({
    where: { id: input.shopId },
    select: {
      id: true,
      onboardingCurrentStep: true,
      onboardingCompletedSteps: true,
      onboardingStartedAt: true,
    },
  });
  if (!shop) redirect("/dashboard?error=missing-shop");
  const completed = [...new Set([...shop.onboardingCompletedSteps, input.step])].sort((a, b) => a - b);
  await prisma.shop.update({
    where: { id: shop.id },
    data: {
      ...(input.data ?? {}),
      onboardingCompletedSteps: { set: completed },
      onboardingCurrentStep: Math.min(10, Math.max(shop.onboardingCurrentStep, input.step + 1)),
      onboardingStartedAt: shop.onboardingStartedAt ?? new Date(),
      onboardingCompletedAt: null,
    },
  });
  await audit({
    shopId: shop.id,
    userId: input.userId,
    action: input.action,
    entityType: "Shop",
    entityId: shop.id,
    metadata: { step: input.step, ...(input.metadata ?? {}) },
  });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/setup");
}

const identitySchema = z.object({ name: z.string().trim().min(2).max(140) });
export async function saveOnboardingIdentityAction(formData: FormData) {
  const { session, shopId } = await onboardingSession();
  const parsed = identitySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) redirect("/dashboard/setup?step=1&error=identity");
  await markStep({ shopId, userId: session.id, step: 1, action: "onboarding.identity_saved", data: { name: parsed.data.name } });
  redirect("/dashboard/setup?step=2&saved=identity");
}

const businessTypeSchema = z.object({ businessType: z.nativeEnum(BusinessType) });
export async function saveOnboardingBusinessTypeAction(formData: FormData) {
  const { session, shopId } = await onboardingSession();
  const parsed = businessTypeSchema.safeParse({ businessType: formData.get("businessType") });
  if (!parsed.success) redirect("/dashboard/setup?step=2&error=business-type");
  await markStep({ shopId, userId: session.id, step: 2, action: "onboarding.business_type_saved", data: { businessType: parsed.data.businessType }, metadata: { businessType: parsed.data.businessType } });
  redirect("/dashboard/setup?step=3&saved=business-type");
}

const locationSchema = z.object({
  region: z.string().trim().min(2).max(100),
  district: z.string().trim().min(2).max(180),
  town: z.string().trim().min(2).max(160),
  area: optionalText(160),
  digitalAddress: optionalText(40),
  streetAddress: optionalText(500),
  landmark: optionalText(700),
});
export async function saveOnboardingLocationAction(formData: FormData) {
  const { session, shopId } = await onboardingSession();
  const parsed = locationSchema.safeParse({
    region: formData.get("region"),
    district: formData.get("district"),
    town: formData.get("town"),
    area: formData.get("area"),
    digitalAddress: formData.get("digitalAddress"),
    streetAddress: formData.get("streetAddress"),
    landmark: formData.get("landmark"),
  });
  const region = parsed.success ? canonicalGhanaRegion(parsed.data.region) : null;
  if (!parsed.success || !region) redirect("/dashboard/setup?step=3&error=location");
  const location = {
    country: "Ghana",
    region,
    district: parsed.data.district,
    town: parsed.data.town,
    area: cleanLocationText(parsed.data.area, 160),
    digitalAddress: cleanLocationText(parsed.data.digitalAddress, 40)?.toUpperCase() ?? null,
    streetAddress: cleanLocationText(parsed.data.streetAddress, 500),
    landmark: cleanLocationText(parsed.data.landmark, 700),
    latitude: null,
    longitude: null,
    searchText: "",
  };
  location.searchText = buildLocationSearchText(location);
  await prisma.$transaction(async (tx) => {
    await tx.shop.update({ where: { id: shopId }, data: { city: location.town, country: location.country, credentialAddress: location.streetAddress } });
    await tx.shopLocation.upsert({ where: { shopId }, create: { shopId, ...location }, update: location });
  });
  await markStep({ shopId, userId: session.id, step: 3, action: "onboarding.location_saved", metadata: { region, district: location.district, town: location.town } });
  redirect("/dashboard/setup?step=4&saved=location");
}

export async function reviewOnboardingModulesAction() {
  const { session, shopId } = await onboardingSession();
  await markStep({ shopId, userId: session.id, step: 4, action: "onboarding.modules_reviewed" });
  redirect("/dashboard/setup?step=5&saved=modules");
}

const moneySchema = z.object({
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  taxRate: z.coerce.number().min(0).max(100),
});
export async function saveOnboardingMoneyAction(formData: FormData) {
  const { session, shopId } = await onboardingSession();
  const parsed = moneySchema.safeParse({ currency: formData.get("currency"), taxRate: formData.get("taxRate") });
  if (!parsed.success) redirect("/dashboard/setup?step=5&error=money");
  await markStep({ shopId, userId: session.id, step: 5, action: "onboarding.money_saved", data: { currency: parsed.data.currency, taxRate: parsed.data.taxRate }, metadata: parsed.data });
  redirect("/dashboard/setup?step=6&saved=money");
}

const paymentSchema = z.object({ allowCash: z.boolean(), allowCard: z.boolean(), allowMomo: z.boolean() }).refine(
  (value) => value.allowCash || value.allowCard || value.allowMomo,
  { message: "At least one payment method is required." },
);
export async function saveOnboardingPaymentsAction(formData: FormData) {
  const { session, shopId } = await onboardingSession();
  const parsed = paymentSchema.safeParse({
    allowCash: formData.get("allowCash") === "on",
    allowCard: formData.get("allowCard") === "on",
    allowMomo: formData.get("allowMomo") === "on",
  });
  if (!parsed.success) redirect("/dashboard/setup?step=6&error=payments");
  await prisma.shopPaymentConfig.upsert({
    where: { shopId },
    create: { shopId, ...parsed.data },
    update: parsed.data,
  });
  await markStep({ shopId, userId: session.id, step: 6, action: "onboarding.payments_saved", metadata: parsed.data });
  redirect("/dashboard/setup?step=7&saved=payments");
}

const receiptSchema = z.object({
  receiptHeader: optionalText(240),
  receiptFooter: optionalText(500),
});
export async function saveOnboardingReceiptAction(formData: FormData) {
  const { session, shopId } = await onboardingSession();
  const parsed = receiptSchema.safeParse({ receiptHeader: formData.get("receiptHeader"), receiptFooter: formData.get("receiptFooter") });
  if (!parsed.success) redirect("/dashboard/setup?step=7&error=receipt");
  await markStep({
    shopId,
    userId: session.id,
    step: 7,
    action: "onboarding.receipt_saved",
    data: { receiptHeader: parsed.data.receiptHeader ?? null, receiptFooter: parsed.data.receiptFooter ?? null },
  });
  redirect("/dashboard/setup?step=8&saved=receipt");
}

export async function reviewOnboardingStaffAction() {
  const { session, shopId } = await onboardingSession();
  await markStep({ shopId, userId: session.id, step: 8, action: "onboarding.staff_reviewed" });
  redirect("/dashboard/setup?step=9&saved=staff");
}

const productionSchema = z.object({
  cutterName: z.string().trim().min(2).max(160),
  cutterConnection: z.string().trim().min(2).max(120),
  heatPress: z.string().trim().min(2).max(160),
  materials: z.string().trim().min(2).max(2000),
  garmentTypes: z.string().trim().min(2).max(2000),
  printLocations: z.string().trim().min(2).max(2000),
  artworkSizes: z.string().trim().min(2).max(2000),
  productionStages: z.string().trim().min(2).max(3000),
  defaultDepositPercent: z.coerce.number().int().min(0).max(100),
});
export async function saveOnboardingProductionAction(formData: FormData) {
  const { session, shopId } = await onboardingSession();
  const parsed = productionSchema.safeParse({
    cutterName: formData.get("cutterName"),
    cutterConnection: formData.get("cutterConnection"),
    heatPress: formData.get("heatPress"),
    materials: formData.get("materials"),
    garmentTypes: formData.get("garmentTypes"),
    printLocations: formData.get("printLocations"),
    artworkSizes: formData.get("artworkSizes"),
    productionStages: formData.get("productionStages"),
    defaultDepositPercent: formData.get("defaultDepositPercent"),
  });
  if (!parsed.success) redirect("/dashboard/setup?production=1&error=production");
  await prisma.shop.update({
    where: { id: shopId },
    data: {
      defaultDepositPercent: parsed.data.defaultDepositPercent,
      productionSetup: { configured: true, manualHeatPress: true, ...parsed.data },
      onboardingStartedAt: new Date(),
      onboardingCompletedAt: null,
    },
  });
  await audit({ shopId, userId: session.id, action: "onboarding.production_saved", entityType: "Shop", entityId: shopId, metadata: { manualHeatPress: true, cutterConnection: parsed.data.cutterConnection } });
  revalidatePath("/dashboard/setup");
  redirect("/dashboard/setup?production=1&saved=production");
}

function productionConfigured(value: Prisma.JsonValue) {
  return typeof value === "object" && value !== null && !Array.isArray(value) && value.configured === true;
}

export async function completeBusinessOnboardingAction() {
  const { session, shopId } = await onboardingSession();
  const [shop, location, paymentConfig, products, services, stockedVariants] = await Promise.all([
    prisma.shop.findFirst({ where: { id: shopId } }),
    prisma.shopLocation.findUnique({ where: { shopId }, select: { id: true } }),
    prisma.shopPaymentConfig.findUnique({ where: { shopId }, select: { id: true, allowCash: true, allowCard: true, allowMomo: true } }),
    prisma.product.count({ where: { shopId } }),
    prisma.product.count({ where: { shopId, isService: true } }),
    prisma.productVariant.count({ where: { product: { shopId, isService: false }, stockQty: { gt: 0 } } }),
  ]);
  if (!shop) redirect("/dashboard?error=missing-shop");
  const coreStepsReady = [1, 2, 3, 4, 5, 6, 7, 8].every((step) => shop.onboardingCompletedSteps.includes(step));
  const paymentsReady = Boolean(paymentConfig && (paymentConfig.allowCash || paymentConfig.allowCard || paymentConfig.allowMomo));
  const stockReady = shop.businessType === BusinessType.SERVICES || services > 0 || stockedVariants > 0;
  const needsProduction = shop.businessType === BusinessType.PRODUCTION_PRINTING || businessModuleEnabled(shop.enabledModules, "PRINTING_PRODUCTION");
  const productionReady = !needsProduction || productionConfigured(shop.productionSetup);
  if (!coreStepsReady || !location || !paymentsReady || products < 1 || !stockReady || !productionReady) {
    redirect("/dashboard/setup?error=incomplete");
  }
  await prisma.shop.update({
    where: { id: shop.id },
    data: {
      onboardingCurrentStep: 10,
      onboardingCompletedSteps: { set: [1,2,3,4,5,6,7,8,9,10] },
      onboardingCompletedAt: new Date(),
      onboardingStartedAt: shop.onboardingStartedAt ?? new Date(),
    },
  });
  await audit({ shopId, userId: session.id, action: "onboarding.completed", entityType: "Shop", entityId: shopId, metadata: { businessType: shop.businessType, products, stockedVariants, productionReady } });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/setup");
  redirect("/dashboard?setup=complete");
}
