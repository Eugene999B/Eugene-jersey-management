"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BillingCycle, PlanTier, Prisma, SubscriptionPlanChangeStatus, SubscriptionStatus } from "@prisma/client";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requirePlatformPermission } from "@/lib/platform-admin";
import {
  SUPPORTED_PLAN_FEATURES,
  resolvePlanPrice,
  snapshotAsJson,
  subscriptionDates,
  subscriptionPlanSnapshot,
} from "@/lib/subscription-plans";

const optionalNumber = (maximum: number) => z.number().int().positive().max(maximum).nullable();

const planSchema = z.object({
  planId: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  monthlyPrice: z.number().min(0).max(100_000_000).nullable(),
  yearlyPrice: z.number().min(0).max(1_000_000_000).nullable(),
  trialDays: z.number().int().min(0).max(365),
  gracePeriodDays: z.number().int().min(0).max(120),
  includedStaffAccounts: optionalNumber(100_000),
  maxProducts: optionalNumber(10_000_000),
  maxOrdersPerMonth: optionalNumber(10_000_000),
  features: z.array(z.enum(SUPPORTED_PLAN_FEATURES)),
  isConfigured: z.boolean(),
  isPublic: z.boolean(),
  isActive: z.boolean(),
  reason: z.string().trim().min(8).max(500),
});

const assignmentSchema = z.object({
  shopId: z.string().min(1),
  planId: z.string().min(1),
  billingCycle: z.nativeEnum(BillingCycle),
  subscriptionStatus: z.nativeEnum(SubscriptionStatus),
  renewalAt: z.date().nullable(),
  reason: z.string().trim().min(8).max(500),
});

function numberOrNull(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function dateOrNull(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const parsed = new Date(`${normalized}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? new Date(Number.NaN) : parsed;
}

function billingRedirect(error: string): never {
  redirect(`/admin/billing?error=${encodeURIComponent(error)}`);
}

export async function saveSubscriptionPlanAction(formData: FormData) {
  const session = await requirePlatformPermission("billing");
  const parsed = planSchema.safeParse({
    planId: formData.get("planId"),
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    currency: formData.get("currency"),
    monthlyPrice: numberOrNull(formData.get("monthlyPrice")),
    yearlyPrice: numberOrNull(formData.get("yearlyPrice")),
    trialDays: numberOrNull(formData.get("trialDays")),
    gracePeriodDays: numberOrNull(formData.get("gracePeriodDays")),
    includedStaffAccounts: numberOrNull(formData.get("includedStaffAccounts")),
    maxProducts: numberOrNull(formData.get("maxProducts")),
    maxOrdersPerMonth: numberOrNull(formData.get("maxOrdersPerMonth")),
    features: formData.getAll("features").map(String),
    isConfigured: formData.get("isConfigured") === "on",
    isPublic: formData.get("isPublic") === "on",
    isActive: formData.get("isActive") === "on",
    reason: formData.get("reason"),
  });
  if (!parsed.success) billingRedirect("plan-values");

  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: parsed.data.planId } });
  if (!plan) billingRedirect("plan-missing");
  if (parsed.data.isPublic && (!parsed.data.isConfigured || !parsed.data.isActive)) billingRedirect("public-plan-state");

  let monthlyPrice = parsed.data.monthlyPrice;
  let yearlyPrice = parsed.data.yearlyPrice;
  if (plan.tier === PlanTier.FREE && parsed.data.isConfigured) {
    monthlyPrice = 0;
    yearlyPrice = 0;
  }
  if (plan.tier !== PlanTier.FREE && parsed.data.isConfigured && (monthlyPrice === null || yearlyPrice === null)) {
    billingRedirect("configured-plan-price");
  }

  const previous = subscriptionPlanSnapshot(plan);
  const next = {
    tier: plan.tier,
    name: parsed.data.name,
    description: parsed.data.description,
    currency: parsed.data.currency,
    monthlyPrice: monthlyPrice === null ? null : monthlyPrice.toFixed(2),
    yearlyPrice: yearlyPrice === null ? null : yearlyPrice.toFixed(2),
    trialDays: parsed.data.trialDays,
    gracePeriodDays: parsed.data.gracePeriodDays,
    includedStaffAccounts: parsed.data.includedStaffAccounts,
    maxProducts: parsed.data.maxProducts,
    maxOrdersPerMonth: parsed.data.maxOrdersPerMonth,
    features: parsed.data.features,
    isConfigured: parsed.data.isConfigured,
    isPublic: parsed.data.isPublic,
    isActive: parsed.data.isActive,
    version: plan.version + 1,
  };
  const decidedAt = new Date();

  const applied = await prisma.$transaction(async (tx) => {
    const changed = await tx.subscriptionPlan.updateMany({
      where: { id: plan.id, version: plan.version },
      data: {
        name: next.name,
        description: next.description || null,
        currency: next.currency,
        monthlyPrice: next.monthlyPrice,
        yearlyPrice: next.yearlyPrice,
        trialDays: next.trialDays,
        gracePeriodDays: next.gracePeriodDays,
        includedStaffAccounts: next.includedStaffAccounts,
        maxProducts: next.maxProducts,
        maxOrdersPerMonth: next.maxOrdersPerMonth,
        features: next.features,
        isConfigured: next.isConfigured,
        isPublic: next.isPublic,
        isActive: next.isActive,
        version: next.version,
        updatedById: session.id,
      },
    });
    if (changed.count !== 1) throw new Error("STALE_PLAN");

    const change = await tx.subscriptionPlanChangeRequest.create({
      data: {
        planId: plan.id,
        basePlanVersion: plan.version,
        status: SubscriptionPlanChangeStatus.APPROVED,
        reason: parsed.data.reason,
        decisionNote: "Applied immediately by the authenticated platform administrator.",
        previousSnapshot: snapshotAsJson(previous),
        proposedSnapshot: snapshotAsJson(next),
        requestedById: session.id,
        decidedById: session.id,
        decidedAt,
      },
    });
    await tx.subscriptionPlanVersion.create({
      data: {
        planId: plan.id,
        version: next.version,
        snapshot: snapshotAsJson(next),
        reason: parsed.data.reason,
        approvedById: session.id,
      },
    });
    return change;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch(() => null);
  if (!applied) billingRedirect("stale-plan");

  await audit({
    userId: session.id,
    action: "admin.subscription_plan_updated",
    entityType: "SubscriptionPlan",
    entityId: plan.id,
    metadata: {
      changeRequestId: applied.id,
      previousVersion: plan.version,
      savedVersion: next.version,
      reason: parsed.data.reason,
      appliedImmediately: true,
    },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/billing");
  revalidatePath("/admin/shops");
  redirect("/admin/billing?saved=1");
}

export async function assignShopSubscriptionAction(formData: FormData) {
  const session = await requirePlatformPermission("billing");
  const parsed = assignmentSchema.safeParse({
    shopId: formData.get("shopId"),
    planId: formData.get("planId"),
    billingCycle: formData.get("billingCycle"),
    subscriptionStatus: formData.get("subscriptionStatus"),
    renewalAt: dateOrNull(formData.get("renewalAt")),
    reason: formData.get("reason"),
  });
  if (!parsed.success) billingRedirect("assignment-values");

  const [shop, plan, previousContract] = await Promise.all([
    prisma.shop.findUnique({ where: { id: parsed.data.shopId } }),
    prisma.subscriptionPlan.findUnique({ where: { id: parsed.data.planId } }),
    prisma.shopSubscriptionContract.findUnique({ where: { shopId: parsed.data.shopId } }),
  ]);
  if (!shop || !plan) billingRedirect("assignment-missing");
  if (!plan.isConfigured || !plan.isActive) billingRedirect("plan-not-assignable");
  const selectedPrice = resolvePlanPrice(plan, parsed.data.billingCycle);
  if (selectedPrice === null) billingRedirect("configured-plan-price");

  const dates = subscriptionDates({
    status: parsed.data.subscriptionStatus,
    trialDays: plan.trialDays,
    gracePeriodDays: plan.gracePeriodDays,
    renewalAt: parsed.data.renewalAt,
  });
  const snapshot = subscriptionPlanSnapshot(plan);

  await prisma.$transaction(async (tx) => {
    await tx.shop.update({
      where: { id: shop.id },
      data: {
        planTier: plan.tier,
        billingCycle: parsed.data.billingCycle,
        subscriptionStatus: parsed.data.subscriptionStatus,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        subscriptionRenewalAt: dates.renewalAt,
      },
    });
    await tx.shopSubscriptionContract.upsert({
      where: { shopId: shop.id },
      create: {
        shopId: shop.id,
        planId: plan.id,
        planVersion: plan.version,
        billingCycle: parsed.data.billingCycle,
        subscriptionStatus: parsed.data.subscriptionStatus,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        trialEndsAt: dates.trialEndsAt,
        renewalAt: dates.renewalAt,
        graceEndsAt: dates.graceEndsAt,
        termsSnapshot: snapshotAsJson(snapshot),
        assignedById: session.id,
        assignmentReason: parsed.data.reason,
      },
      update: {
        planId: plan.id,
        planVersion: plan.version,
        billingCycle: parsed.data.billingCycle,
        subscriptionStatus: parsed.data.subscriptionStatus,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        trialEndsAt: dates.trialEndsAt,
        renewalAt: dates.renewalAt,
        graceEndsAt: dates.graceEndsAt,
        termsSnapshot: snapshotAsJson(snapshot),
        assignedById: session.id,
        assignmentReason: parsed.data.reason,
      },
    });
  });

  await audit({
    shopId: shop.id,
    userId: session.id,
    action: "admin.shop_subscription_assigned",
    entityType: "ShopSubscriptionContract",
    entityId: previousContract?.id ?? shop.id,
    metadata: {
      reason: parsed.data.reason,
      previous: previousContract ? { planId: previousContract.planId, planVersion: previousContract.planVersion, status: previousContract.subscriptionStatus, cycle: previousContract.billingCycle } : null,
      next: { planId: plan.id, planVersion: plan.version, tier: plan.tier, status: parsed.data.subscriptionStatus, cycle: parsed.data.billingCycle, selectedPrice },
    },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/billing");
  revalidatePath("/admin/shops");
  revalidatePath(`/admin/shops/${shop.id}`);
  redirect("/admin/billing?assigned=1");
}
