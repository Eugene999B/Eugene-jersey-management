"use server";

import {
  BillingCycle,
  PlanTier,
  Prisma,
  SubscriptionAccessExpiryAction,
  SubscriptionAccessType,
  SubscriptionInvoiceStatus,
  SubscriptionStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { requirePlatformPermission } from "@/lib/platform-admin";
import {
  SUPPORTED_PLAN_FEATURES,
  snapshotAsJson,
  subscriptionPlanSnapshot,
} from "@/lib/subscription-plans";

const grantSchema = z.object({
  shopId: z.string().min(1),
  accessType: z.nativeEnum(SubscriptionAccessType),
  planId: z.string().min(1),
  startsAt: z.date(),
  endsAt: z.date().nullable(),
  priceOverride: z.number().min(0).max(1_000_000_000).nullable(),
  invoicesDisabled: z.boolean(),
  reason: z.string().trim().min(8).max(1000),
  expiryAction: z.nativeEnum(SubscriptionAccessExpiryAction),
  expiryPlanId: z.string().nullable(),
  automaticExtensionDays: z.number().int().min(1).max(3650).nullable(),
  featureOverrides: z.array(z.enum(SUPPORTED_PLAN_FEATURES)),
});

function dateValue(value: FormDataEntryValue | null, endOfDay = false) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const time = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
  const parsed = new Date(`${normalized}${time}`);
  return Number.isNaN(parsed.getTime()) ? new Date(Number.NaN) : parsed;
}

function numberValue(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function accessRedirect(error: string): never {
  redirect(`/admin/access?error=${encodeURIComponent(error)}`);
}

function statusForAccessType(type: SubscriptionAccessType) {
  if (type === SubscriptionAccessType.SUSPENDED) return SubscriptionStatus.SUSPENDED;
  if (type === SubscriptionAccessType.FREE_TRIAL) return SubscriptionStatus.TRIAL;
  return SubscriptionStatus.ACTIVE;
}

function requiresEndDate(type: SubscriptionAccessType) {
  return [
    SubscriptionAccessType.FREE_TRIAL,
    SubscriptionAccessType.SPONSORED,
    SubscriptionAccessType.PROMOTIONAL,
    SubscriptionAccessType.EMERGENCY,
  ].includes(type);
}

export async function grantShopAccessAction(formData: FormData) {
  const session = await requirePlatformPermission("billing");
  const parsed = grantSchema.safeParse({
    shopId: formData.get("shopId"),
    accessType: formData.get("accessType"),
    planId: formData.get("planId"),
    startsAt: dateValue(formData.get("startsAt")),
    endsAt: dateValue(formData.get("endsAt"), true),
    priceOverride: numberValue(formData.get("priceOverride")),
    invoicesDisabled: formData.get("invoicesDisabled") === "on",
    reason: formData.get("reason"),
    expiryAction: formData.get("expiryAction"),
    expiryPlanId: String(formData.get("expiryPlanId") ?? "").trim() || null,
    automaticExtensionDays: numberValue(formData.get("automaticExtensionDays")),
    featureOverrides: formData.getAll("featureOverrides").map(String),
  });
  if (!parsed.success) accessRedirect("values");

  const input = parsed.data;
  if (requiresEndDate(input.accessType) && !input.endsAt) accessRedirect("end-required");
  if (input.endsAt && input.endsAt <= input.startsAt) accessRedirect("date-order");
  if (input.accessType === SubscriptionAccessType.FREE_FOREVER && input.endsAt) accessRedirect("free-forever-end");
  if (input.expiryAction === SubscriptionAccessExpiryAction.EXTEND_AUTOMATICALLY && (!input.endsAt || !input.automaticExtensionDays)) accessRedirect("extension");
  if (input.expiryAction === SubscriptionAccessExpiryAction.MOVE_TO_PAID && !input.expiryPlanId) accessRedirect("expiry-plan");

  const [shop, plan, expiryPlan] = await Promise.all([
    prisma.shop.findUnique({ where: { id: input.shopId } }),
    prisma.subscriptionPlan.findUnique({ where: { id: input.planId } }),
    input.expiryPlanId ? prisma.subscriptionPlan.findUnique({ where: { id: input.expiryPlanId } }) : Promise.resolve(null),
  ]);
  if (!shop || !plan) accessRedirect("missing");
  if (!plan.isConfigured || !plan.isActive) accessRedirect("plan");
  if (input.expiryAction === SubscriptionAccessExpiryAction.MOVE_TO_PAID && (!expiryPlan || expiryPlan.tier === PlanTier.FREE || !expiryPlan.isConfigured || !expiryPlan.isActive)) accessRedirect("expiry-paid-plan");
  if (input.expiryAction === SubscriptionAccessExpiryAction.RETURN_TO_FREE) {
    const freePlan = expiryPlan ?? await prisma.subscriptionPlan.findUnique({ where: { tier: PlanTier.FREE } });
    if (!freePlan || freePlan.tier !== PlanTier.FREE || !freePlan.isConfigured || !freePlan.isActive) accessRedirect("expiry-free-plan");
  }

  const freeLike = [
    SubscriptionAccessType.FREE_TRIAL,
    SubscriptionAccessType.SPONSORED,
    SubscriptionAccessType.FREE_FOREVER,
    SubscriptionAccessType.EMERGENCY,
    SubscriptionAccessType.SUSPENDED,
  ].includes(input.accessType);
  const invoicesDisabled = freeLike ? true : input.invoicesDisabled;
  const priceOverride = input.accessType === SubscriptionAccessType.FREE_FOREVER ? new Prisma.Decimal(0) : input.priceOverride === null ? null : new Prisma.Decimal(input.priceOverride);
  const snapshot = subscriptionPlanSnapshot(plan);
  const termsSnapshot = input.featureOverrides.length
    ? snapshotAsJson({ ...snapshot, features: input.featureOverrides })
    : snapshotAsJson(snapshot);
  const status = statusForAccessType(input.accessType);
  const billingCycle = shop.billingCycle ?? BillingCycle.MONTHLY;
  const renewalAt = input.endsAt;

  const grant = await prisma.$transaction(async (tx) => {
    const existing = await tx.shopAccessGrant.findFirst({ where: { shopId: shop.id, isActive: true } });
    if (existing) {
      await tx.shopAccessGrant.update({
        where: { id: existing.id },
        data: {
          isActive: false,
          revokedAt: new Date(),
          revokedById: session.id,
          revocationReason: `Superseded by a new ${input.accessType} grant.`,
        },
      });
    }

    const created = await tx.shopAccessGrant.create({
      data: {
        shopId: shop.id,
        accessType: input.accessType,
        planId: plan.id,
        planVersion: plan.version,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        priceOverride,
        invoicesDisabled,
        reason: input.reason,
        approvedById: session.id,
        expiryAction: input.expiryAction,
        expiryPlanId: input.expiryAction === SubscriptionAccessExpiryAction.RETURN_TO_FREE
          ? (expiryPlan?.id ?? (await tx.subscriptionPlan.findUniqueOrThrow({ where: { tier: PlanTier.FREE } })).id)
          : input.expiryPlanId,
        automaticExtensionDays: input.automaticExtensionDays,
        featureOverrides: input.featureOverrides,
        termsSnapshot,
      },
    });

    await tx.shop.update({
      where: { id: shop.id },
      data: {
        planTier: plan.tier,
        subscriptionStatus: status,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        subscriptionRenewalAt: renewalAt,
      },
    });
    await tx.shopSubscriptionContract.upsert({
      where: { shopId: shop.id },
      create: {
        shopId: shop.id,
        planId: plan.id,
        planVersion: plan.version,
        billingCycle,
        subscriptionStatus: status,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        trialEndsAt: input.accessType === SubscriptionAccessType.FREE_TRIAL ? input.endsAt : null,
        renewalAt,
        graceEndsAt: null,
        termsSnapshot,
        assignedById: session.id,
        assignmentReason: `Administrator access grant: ${input.reason}`,
      },
      update: {
        planId: plan.id,
        planVersion: plan.version,
        billingCycle,
        subscriptionStatus: status,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        trialEndsAt: input.accessType === SubscriptionAccessType.FREE_TRIAL ? input.endsAt : null,
        renewalAt,
        graceEndsAt: null,
        termsSnapshot,
        assignedById: session.id,
        assignmentReason: `Administrator access grant: ${input.reason}`,
      },
    });

    if (invoicesDisabled) {
      await tx.subscriptionInvoice.updateMany({
        where: {
          shopId: shop.id,
          status: { in: [SubscriptionInvoiceStatus.OPEN, SubscriptionInvoiceStatus.OVERDUE] },
        },
        data: {
          status: SubscriptionInvoiceStatus.VOID,
          voidedAt: new Date(),
          voidReason: `Invoice suppressed by ${input.accessType} grant approved by ${session.name}.`,
          nextReminderAt: null,
        },
      });
    }
    return created;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  await audit({
    shopId: shop.id,
    userId: session.id,
    action: "admin.shop_access_granted",
    entityType: "ShopAccessGrant",
    entityId: grant.id,
    metadata: {
      accessType: input.accessType,
      planId: plan.id,
      planVersion: plan.version,
      startsAt: input.startsAt.toISOString(),
      endsAt: input.endsAt?.toISOString() ?? null,
      priceOverride: priceOverride?.toFixed(2) ?? null,
      invoicesDisabled,
      expiryAction: input.expiryAction,
      expiryPlanId: grant.expiryPlanId,
      automaticExtensionDays: input.automaticExtensionDays,
      featureOverrides: input.featureOverrides,
      reason: input.reason,
    },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/access");
  revalidatePath("/admin/billing");
  revalidatePath(`/admin/shops/${shop.id}`);
  revalidatePath("/dashboard/subscription");
  redirect(`/admin/access?granted=${grant.id}`);
}

const revokeSchema = z.object({
  grantId: z.string().min(1),
  reason: z.string().trim().min(8).max(1000),
});

export async function revokeShopAccessAction(formData: FormData) {
  const session = await requirePlatformPermission("billing");
  const parsed = revokeSchema.safeParse({ grantId: formData.get("grantId"), reason: formData.get("reason") });
  if (!parsed.success) accessRedirect("revoke");
  const grant = await prisma.shopAccessGrant.findUnique({ where: { id: parsed.data.grantId } });
  if (!grant || !grant.isActive) accessRedirect("grant-missing");
  await prisma.shopAccessGrant.update({
    where: { id: grant.id },
    data: {
      isActive: false,
      revokedAt: new Date(),
      revokedById: session.id,
      revocationReason: parsed.data.reason,
    },
  });
  await audit({
    shopId: grant.shopId,
    userId: session.id,
    action: "admin.shop_access_revoked",
    entityType: "ShopAccessGrant",
    entityId: grant.id,
    metadata: { accessType: grant.accessType, reason: parsed.data.reason },
  });
  revalidatePath("/admin/access");
  revalidatePath("/admin/billing");
  revalidatePath(`/admin/shops/${grant.shopId}`);
  revalidatePath("/dashboard/subscription");
  redirect("/admin/access?revoked=1");
}
