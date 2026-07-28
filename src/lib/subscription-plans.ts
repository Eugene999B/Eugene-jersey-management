import { BillingCycle, PlanTier, SubscriptionStatus, type Prisma, type SubscriptionPlan } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const SUPPORTED_PLAN_FEATURES = [
  "STOREFRONT",
  "POS",
  "INVENTORY",
  "DESIGN_STUDIO",
  "SUPPLIERS",
  "SHOP_NETWORK",
  "CUSTOMER_MESSAGING",
  "ADVANCED_REPORTS",
] as const;

export const subscriptionPlanSnapshotSchema = z.object({
  tier: z.nativeEnum(PlanTier),
  name: z.string(),
  description: z.string(),
  currency: z.string().length(3),
  monthlyPrice: z.string().nullable(),
  yearlyPrice: z.string().nullable(),
  trialDays: z.number().int().min(0),
  gracePeriodDays: z.number().int().min(0),
  includedStaffAccounts: z.number().int().positive().nullable(),
  maxProducts: z.number().int().positive().nullable(),
  maxOrdersPerMonth: z.number().int().positive().nullable(),
  features: z.array(z.enum(SUPPORTED_PLAN_FEATURES)),
  isConfigured: z.boolean(),
  isPublic: z.boolean(),
  isActive: z.boolean(),
  version: z.number().int().positive(),
});

export type SubscriptionPlanSnapshot = z.infer<typeof subscriptionPlanSnapshotSchema>;

export const DEFAULT_PLAN_CATALOGUE = [
  { tier: PlanTier.FREE, name: "Free", description: "Migration placeholder. Submit and approve commercial terms before offering this plan publicly.", trialDays: 0, gracePeriodDays: 0 },
  { tier: PlanTier.BASIC, name: "Basic", description: "Migration placeholder. Existing tenant prices remain unchanged until reassigned.", trialDays: 14, gracePeriodDays: 7 },
  { tier: PlanTier.PRO, name: "Pro", description: "Migration placeholder. Existing tenant prices remain unchanged until reassigned.", trialDays: 14, gracePeriodDays: 7 },
  { tier: PlanTier.ENTERPRISE, name: "Enterprise", description: "Migration placeholder. Existing tenant prices remain unchanged until reassigned.", trialDays: 14, gracePeriodDays: 14 },
] as const;

const tierOrder: Record<PlanTier, number> = {
  FREE: 0,
  BASIC: 1,
  PRO: 2,
  ENTERPRISE: 3,
};

export function sortSubscriptionPlans<T extends { tier: PlanTier }>(plans: T[]) {
  return [...plans].sort((left, right) => tierOrder[left.tier] - tierOrder[right.tier]);
}

export async function ensureSubscriptionPlans() {
  await prisma.subscriptionPlan.createMany({
    data: DEFAULT_PLAN_CATALOGUE.map((plan) => ({ ...plan, currency: "GHS" })),
    skipDuplicates: true,
  });
  return sortSubscriptionPlans(await prisma.subscriptionPlan.findMany());
}

export function subscriptionPlanSnapshot(plan: SubscriptionPlan): SubscriptionPlanSnapshot {
  return {
    tier: plan.tier,
    name: plan.name,
    description: plan.description ?? "",
    currency: plan.currency,
    monthlyPrice: plan.monthlyPrice?.toFixed(2) ?? null,
    yearlyPrice: plan.yearlyPrice?.toFixed(2) ?? null,
    trialDays: plan.trialDays,
    gracePeriodDays: plan.gracePeriodDays,
    includedStaffAccounts: plan.includedStaffAccounts,
    maxProducts: plan.maxProducts,
    maxOrdersPerMonth: plan.maxOrdersPerMonth,
    features: plan.features.filter((feature): feature is (typeof SUPPORTED_PLAN_FEATURES)[number] => SUPPORTED_PLAN_FEATURES.includes(feature as (typeof SUPPORTED_PLAN_FEATURES)[number])),
    isConfigured: plan.isConfigured,
    isPublic: plan.isPublic,
    isActive: plan.isActive,
    version: plan.version,
  };
}

export function snapshotAsJson(snapshot: SubscriptionPlanSnapshot): Prisma.InputJsonObject {
  return snapshot as unknown as Prisma.InputJsonObject;
}

export function parseSubscriptionPlanSnapshot(value: Prisma.JsonValue) {
  return subscriptionPlanSnapshotSchema.safeParse(value);
}

export function canApproveCommercialChange(requestedById: string, approverId: string) {
  return Boolean(requestedById && approverId && requestedById !== approverId);
}

export function resolvePlanPrice(plan: Pick<SubscriptionPlan, "monthlyPrice" | "yearlyPrice">, cycle: BillingCycle) {
  const value = cycle === BillingCycle.YEARLY ? plan.yearlyPrice : plan.monthlyPrice;
  return value?.toFixed(2) ?? null;
}

export function subscriptionDates(input: {
  status: SubscriptionStatus;
  trialDays: number;
  gracePeriodDays: number;
  renewalAt?: Date | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (input.status === SubscriptionStatus.TRIAL) {
    const trialEndsAt = new Date(now.getTime() + input.trialDays * 86_400_000);
    return { trialEndsAt, renewalAt: trialEndsAt, graceEndsAt: null };
  }
  if (input.status === SubscriptionStatus.PAST_DUE) {
    const renewalAt = input.renewalAt ?? now;
    return {
      trialEndsAt: null,
      renewalAt,
      graceEndsAt: new Date(renewalAt.getTime() + input.gracePeriodDays * 86_400_000),
    };
  }
  return { trialEndsAt: null, renewalAt: input.renewalAt ?? null, graceEndsAt: null };
}

export function formatNullableLimit(value: number | null) {
  return value === null ? "Unlimited / not configured" : value.toLocaleString("en-GB");
}
