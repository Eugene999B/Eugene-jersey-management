import "server-only";

import {
  BillingCycle,
  PlanTier,
  Prisma,
  SubscriptionAccessExpiryAction,
  SubscriptionAccessType,
  SubscriptionStatus,
  type ShopAccessGrant,
} from "@prisma/client";
import { platformDb } from "@/lib/platform-db";
import {
  SUPPORTED_PLAN_FEATURES,
  parseSubscriptionPlanSnapshot,
  snapshotAsJson,
  subscriptionPlanSnapshot,
  type SubscriptionPlanSnapshot,
} from "@/lib/subscription-plans";

const DAY_MS = 86_400_000;

export type ActiveAccessGrant = ShopAccessGrant & {
  snapshot: SubscriptionPlanSnapshot;
};

function accessTypeStatus(accessType: SubscriptionAccessType) {
  if (accessType === SubscriptionAccessType.SUSPENDED) return SubscriptionStatus.SUSPENDED;
  if (accessType === SubscriptionAccessType.FREE_TRIAL) return SubscriptionStatus.TRIAL;
  return SubscriptionStatus.ACTIVE;
}

export function accessTypeLabel(accessType: SubscriptionAccessType) {
  const labels: Record<SubscriptionAccessType, string> = {
    PAID: "Paid subscription",
    FREE_TRIAL: "Free trial",
    SPONSORED: "Sponsored access",
    PROMOTIONAL: "Promotional access",
    FREE_FOREVER: "Free forever",
    EMERGENCY: "Temporary emergency access",
    SUSPENDED: "Suspended access",
  };
  return labels[accessType];
}

export function accessGrantSnapshot(grant: Pick<ShopAccessGrant, "termsSnapshot" | "featureOverrides">) {
  const parsed = parseSubscriptionPlanSnapshot(grant.termsSnapshot);
  if (!parsed.success) return null;
  if (!grant.featureOverrides.length) return parsed.data;
  const features = grant.featureOverrides.filter((feature): feature is (typeof SUPPORTED_PLAN_FEATURES)[number] =>
    SUPPORTED_PLAN_FEATURES.includes(feature as (typeof SUPPORTED_PLAN_FEATURES)[number]),
  );
  return { ...parsed.data, features };
}

async function applyExpiryPlan(input: {
  grant: ShopAccessGrant;
  planId: string;
  status: SubscriptionStatus;
  now: Date;
}) {
  await platformDb.$transaction(async (tx) => {
    const [shop, plan] = await Promise.all([
      tx.shop.findUnique({ where: { id: input.grant.shopId } }),
      tx.subscriptionPlan.findUnique({ where: { id: input.planId } }),
    ]);
    if (!shop || !plan || !plan.isConfigured || !plan.isActive) {
      await tx.shopAccessGrant.update({
        where: { id: input.grant.id },
        data: {
          isActive: false,
          expiredAt: input.now,
          expiryOutcome: "ADMIN_REVIEW_REQUIRED_PLAN_UNAVAILABLE",
        },
      });
      if (shop) {
        await tx.shop.update({ where: { id: shop.id }, data: { subscriptionStatus: SubscriptionStatus.SUSPENDED } });
        await tx.shopSubscriptionContract.updateMany({
          where: { shopId: shop.id },
          data: { subscriptionStatus: SubscriptionStatus.SUSPENDED },
        });
      }
      return;
    }

    const snapshot = subscriptionPlanSnapshot(plan);
    const billingCycle = shop.billingCycle ?? BillingCycle.MONTHLY;
    const renewalAt = input.status === SubscriptionStatus.PAST_DUE ? input.now : null;
    const graceEndsAt = input.status === SubscriptionStatus.PAST_DUE
      ? new Date(input.now.getTime() + plan.gracePeriodDays * DAY_MS)
      : null;

    await tx.shop.update({
      where: { id: shop.id },
      data: {
        planTier: plan.tier,
        subscriptionStatus: input.status,
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
        subscriptionStatus: input.status,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        trialEndsAt: null,
        renewalAt,
        graceEndsAt,
        termsSnapshot: snapshotAsJson(snapshot),
        assignedById: input.grant.approvedById,
        assignmentReason: `Automatic access-grant expiry outcome: ${input.grant.expiryAction}`,
      },
      update: {
        planId: plan.id,
        planVersion: plan.version,
        billingCycle,
        subscriptionStatus: input.status,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        trialEndsAt: null,
        renewalAt,
        graceEndsAt,
        termsSnapshot: snapshotAsJson(snapshot),
        assignedById: input.grant.approvedById,
        assignmentReason: `Automatic access-grant expiry outcome: ${input.grant.expiryAction}`,
      },
    });
    await tx.shopAccessGrant.update({
      where: { id: input.grant.id },
      data: {
        isActive: false,
        expiredAt: input.now,
        expiryOutcome: `${input.grant.expiryAction}:${plan.tier}`,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function reconcileExpiredShopAccessGrant(shopId: string, now = new Date()) {
  const grant = await platformDb.shopAccessGrant.findFirst({
    where: { shopId, isActive: true, endsAt: { lt: now } },
    orderBy: { createdAt: "desc" },
  });
  if (!grant || !grant.endsAt) return null;

  if (grant.expiryAction === SubscriptionAccessExpiryAction.EXTEND_AUTOMATICALLY) {
    const extensionDays = grant.automaticExtensionDays;
    if (!extensionDays) {
      await platformDb.shopAccessGrant.update({
        where: { id: grant.id },
        data: { isActive: false, expiredAt: now, expiryOutcome: "ADMIN_REVIEW_REQUIRED_EXTENSION_MISSING" },
      });
      return null;
    }
    const interval = extensionDays * DAY_MS;
    const periods = Math.floor((now.getTime() - grant.endsAt.getTime()) / interval) + 1;
    const endsAt = new Date(grant.endsAt.getTime() + periods * interval);
    return platformDb.shopAccessGrant.update({
      where: { id: grant.id },
      data: { endsAt, expiredAt: null, expiryOutcome: `AUTO_EXTENDED_${periods}_PERIODS` },
    });
  }

  if (grant.expiryAction === SubscriptionAccessExpiryAction.RETURN_TO_FREE) {
    const freePlan = grant.expiryPlanId
      ? await platformDb.subscriptionPlan.findUnique({ where: { id: grant.expiryPlanId } })
      : await platformDb.subscriptionPlan.findUnique({ where: { tier: PlanTier.FREE } });
    if (freePlan) {
      await applyExpiryPlan({ grant, planId: freePlan.id, status: SubscriptionStatus.ACTIVE, now });
      return null;
    }
  }

  if (grant.expiryAction === SubscriptionAccessExpiryAction.MOVE_TO_PAID && grant.expiryPlanId) {
    await applyExpiryPlan({ grant, planId: grant.expiryPlanId, status: SubscriptionStatus.PAST_DUE, now });
    return null;
  }

  await platformDb.$transaction(async (tx) => {
    await tx.shopAccessGrant.update({
      where: { id: grant.id },
      data: {
        isActive: false,
        expiredAt: now,
        expiryOutcome: grant.expiryAction === SubscriptionAccessExpiryAction.ADMIN_REVIEW
          ? "ADMIN_REVIEW_REQUIRED"
          : "COMMERCIAL_ACTIONS_SUSPENDED",
      },
    });
    await tx.shop.update({ where: { id: shopId }, data: { subscriptionStatus: SubscriptionStatus.SUSPENDED } });
    await tx.shopSubscriptionContract.updateMany({
      where: { shopId },
      data: { subscriptionStatus: SubscriptionStatus.SUSPENDED },
    });
  });
  return null;
}

export async function activeShopAccessGrant(shopId: string, now = new Date()): Promise<ActiveAccessGrant | null> {
  await reconcileExpiredShopAccessGrant(shopId, now);
  const grant = await platformDb.shopAccessGrant.findFirst({
    where: {
      shopId,
      isActive: true,
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gte: now } }],
    },
    orderBy: { createdAt: "desc" },
  });
  if (!grant) return null;
  const snapshot = accessGrantSnapshot(grant);
  return snapshot ? { ...grant, snapshot } : null;
}

export function accessGrantCommercialStatus(grant: ActiveAccessGrant) {
  return accessTypeStatus(grant.accessType);
}
