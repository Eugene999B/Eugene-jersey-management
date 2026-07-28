"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BillingCycle, PlanTier, SubscriptionPlanChangeStatus, SubscriptionStatus } from "@prisma/client";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requirePlatformPermission } from "@/lib/platform-admin";
import {
  SUPPORTED_PLAN_FEATURES,
  canApproveCommercialChange,
  parseSubscriptionPlanSnapshot,
  resolvePlanPrice,
  snapshotAsJson,
  subscriptionDates,
  subscriptionPlanSnapshot,
} from "@/lib/subscription-plans";

const optionalNumber = (maximum: number) => z.number().int().positive().max(maximum).nullable();

const planProposalSchema = z.object({
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

const decisionSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(["APPROVE", "REJECT"]),
  decisionNote: z.string().trim().min(5).max(500),
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

export async function requestSubscriptionPlanChangeAction(formData: FormData) {
  const session = await requirePlatformPermission("billing");
  const parsed = planProposalSchema.safeParse({
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

  const existingPending = await prisma.subscriptionPlanChangeRequest.findFirst({
    where: { planId: plan.id, status: SubscriptionPlanChangeStatus.PENDING },
    select: { id: true },
  });
  if (existingPending) billingRedirect("pending-plan-change");

  const previous = subscriptionPlanSnapshot(plan);
  const proposed = {
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

  const request = await prisma.subscriptionPlanChangeRequest.create({
    data: {
      planId: plan.id,
      basePlanVersion: plan.version,
      reason: parsed.data.reason,
      previousSnapshot: snapshotAsJson(previous),
      proposedSnapshot: snapshotAsJson(proposed),
      requestedById: session.id,
    },
  });
  await audit({
    userId: session.id,
    action: "admin.subscription_plan_change_requested",
    entityType: "SubscriptionPlanChangeRequest",
    entityId: request.id,
    metadata: { planId: plan.id, tier: plan.tier, basePlanVersion: plan.version, proposedVersion: proposed.version, reason: parsed.data.reason },
  });
  revalidatePath("/admin/billing");
  redirect("/admin/billing?requested=1");
}

export async function decideSubscriptionPlanChangeAction(formData: FormData) {
  const session = await requirePlatformPermission("billing");
  const parsed = decisionSchema.safeParse({
    requestId: formData.get("requestId"),
    decision: formData.get("decision"),
    decisionNote: formData.get("decisionNote"),
  });
  if (!parsed.success) billingRedirect("decision-values");

  const request = await prisma.subscriptionPlanChangeRequest.findUnique({
    where: { id: parsed.data.requestId },
    include: { plan: true },
  });
  if (!request || request.status !== SubscriptionPlanChangeStatus.PENDING) billingRedirect("request-state");
  if (!canApproveCommercialChange(request.requestedById, session.id)) billingRedirect("self-approval");

  if (parsed.data.decision === "REJECT") {
    const rejected = await prisma.subscriptionPlanChangeRequest.updateMany({
      where: { id: request.id, status: SubscriptionPlanChangeStatus.PENDING },
      data: { status: SubscriptionPlanChangeStatus.REJECTED, decisionNote: parsed.data.decisionNote, decidedById: session.id, decidedAt: new Date() },
    });
    if (rejected.count !== 1) billingRedirect("request-state");
    await audit({
      userId: session.id,
      action: "admin.subscription_plan_change_rejected",
      entityType: "SubscriptionPlanChangeRequest",
      entityId: request.id,
      metadata: { planId: request.planId, requestedById: request.requestedById, decisionNote: parsed.data.decisionNote },
    });
    revalidatePath("/admin/billing");
    redirect("/admin/billing?rejected=1");
  }

  const proposed = parseSubscriptionPlanSnapshot(request.proposedSnapshot);
  if (!proposed.success || proposed.data.version !== request.basePlanVersion + 1) billingRedirect("proposal-corrupt");

  const applied = await prisma.$transaction(async (tx) => {
    const claimed = await tx.subscriptionPlanChangeRequest.updateMany({
      where: { id: request.id, status: SubscriptionPlanChangeStatus.PENDING },
      data: { status: SubscriptionPlanChangeStatus.APPROVED, decisionNote: parsed.data.decisionNote, decidedById: session.id, decidedAt: new Date() },
    });
    if (claimed.count !== 1) throw new Error("REQUEST_STATE");

    const planChanged = await tx.subscriptionPlan.updateMany({
      where: { id: request.planId, version: request.basePlanVersion },
      data: {
        name: proposed.data.name,
        description: proposed.data.description || null,
        currency: proposed.data.currency,
        monthlyPrice: proposed.data.monthlyPrice,
        yearlyPrice: proposed.data.yearlyPrice,
        trialDays: proposed.data.trialDays,
        gracePeriodDays: proposed.data.gracePeriodDays,
        includedStaffAccounts: proposed.data.includedStaffAccounts,
        maxProducts: proposed.data.maxProducts,
        maxOrdersPerMonth: proposed.data.maxOrdersPerMonth,
        features: proposed.data.features,
        isConfigured: proposed.data.isConfigured,
        isPublic: proposed.data.isPublic,
        isActive: proposed.data.isActive,
        version: proposed.data.version,
        updatedById: session.id,
      },
    });
    if (planChanged.count !== 1) throw new Error("STALE_PLAN");

    await tx.subscriptionPlanVersion.create({
      data: {
        planId: request.planId,
        version: proposed.data.version,
        snapshot: snapshotAsJson(proposed.data),
        reason: request.reason,
        approvedById: session.id,
      },
    });
    return proposed.data;
  }).catch(() => null);
  if (!applied) billingRedirect("stale-plan");

  await audit({
    userId: session.id,
    action: "admin.subscription_plan_change_approved",
    entityType: "SubscriptionPlan",
    entityId: request.planId,
    metadata: { requestId: request.id, requestedById: request.requestedById, approvedVersion: applied.version, decisionNote: parsed.data.decisionNote },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/billing");
  revalidatePath("/admin/shops");
  redirect("/admin/billing?approved=1");
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
