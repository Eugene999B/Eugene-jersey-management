import { OrderChannel, Prisma, SubscriptionStatus } from "@prisma/client";
import { platformDb } from "@/lib/platform-db";
import {
  SUPPORTED_PLAN_FEATURES,
  parseSubscriptionPlanSnapshot,
  subscriptionPlanSnapshot,
  type SubscriptionPlanSnapshot,
} from "@/lib/subscription-plans";

export type SubscriptionFeature = (typeof SUPPORTED_PLAN_FEATURES)[number];
export type SubscriptionBlockCode =
  | "SUBSCRIPTION_SUSPENDED"
  | "SUBSCRIPTION_CANCELLED"
  | "SUBSCRIPTION_EXPIRED"
  | "FEATURE_NOT_INCLUDED"
  | "PRODUCT_LIMIT_REACHED"
  | "ORDER_LIMIT_REACHED";

type SubscriptionDb = Pick<
  Prisma.TransactionClient,
  "shopSubscriptionContract" | "subscriptionPlan" | "shop" | "product" | "order" | "user" | "inviteToken"
>;

type ContractDates = {
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: Date | null;
  renewalAt: Date | null;
  graceEndsAt: Date | null;
};

export type CommercialSubscriptionState = {
  shopId: string;
  hasContract: boolean;
  enforcementEnabled: boolean;
  recordedStatus: SubscriptionStatus;
  effectiveStatus: SubscriptionStatus;
  operational: boolean;
  snapshot: SubscriptionPlanSnapshot | null;
  trialEndsAt: Date | null;
  renewalAt: Date | null;
  graceEndsAt: Date | null;
  deadline: Date | null;
  notice: string | null;
  blockCode: SubscriptionBlockCode | null;
};

export type SubscriptionUsageState = CommercialSubscriptionState & {
  monthStart: Date;
  monthEnd: Date;
  productCount: number;
  monthlyOrderCount: number;
  activeStaff: number;
  pendingInvites: number;
  reservedStaff: number;
  productLimit: number | null;
  monthlyOrderLimit: number | null;
  staffLimit: number | null;
};

export class CommercialSubscriptionError extends Error {
  constructor(
    public readonly code: SubscriptionBlockCode,
    message: string,
    public readonly limit: number | null = null,
  ) {
    super(message);
    this.name = "CommercialSubscriptionError";
  }
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + Math.max(0, days) * 86_400_000);
}

export function subscriptionMonthWindow(now = new Date()) {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { monthStart, monthEnd };
}

function effectiveGraceEnd(dates: ContractDates, snapshot: SubscriptionPlanSnapshot | null) {
  if (dates.graceEndsAt) return dates.graceEndsAt;
  const due = dates.subscriptionStatus === SubscriptionStatus.TRIAL
    ? dates.trialEndsAt ?? dates.renewalAt
    : dates.renewalAt;
  return due && snapshot ? addDays(due, snapshot.gracePeriodDays) : null;
}

export function deriveCommercialSubscriptionState(input: {
  shopId: string;
  hasContract: boolean;
  snapshot: SubscriptionPlanSnapshot | null;
  dates: ContractDates;
  now?: Date;
}): CommercialSubscriptionState {
  const now = input.now ?? new Date();
  const enforcementEnabled = input.hasContract && Boolean(input.snapshot?.isConfigured);
  const graceEndsAt = effectiveGraceEnd(input.dates, input.snapshot);
  const base = {
    shopId: input.shopId,
    hasContract: input.hasContract,
    enforcementEnabled,
    recordedStatus: input.dates.subscriptionStatus,
    snapshot: input.snapshot,
    trialEndsAt: input.dates.trialEndsAt,
    renewalAt: input.dates.renewalAt,
    graceEndsAt,
  };

  if (!enforcementEnabled) {
    return {
      ...base,
      effectiveStatus: input.dates.subscriptionStatus,
      operational: true,
      deadline: input.dates.trialEndsAt ?? input.dates.renewalAt,
      notice: input.hasContract
        ? "This contract is not yet using configured commercial enforcement."
        : "This shop is still on legacy access until a configured plan is assigned.",
      blockCode: null,
    };
  }

  if (input.dates.subscriptionStatus === SubscriptionStatus.CANCELLED) {
    return {
      ...base,
      effectiveStatus: SubscriptionStatus.CANCELLED,
      operational: false,
      deadline: null,
      notice: "This subscription has been cancelled. Assign or renew a plan before commercial operations continue.",
      blockCode: "SUBSCRIPTION_CANCELLED",
    };
  }

  if (input.dates.subscriptionStatus === SubscriptionStatus.SUSPENDED) {
    return {
      ...base,
      effectiveStatus: SubscriptionStatus.SUSPENDED,
      operational: false,
      deadline: graceEndsAt,
      notice: "This subscription is suspended. The owner can still review settings and subscription details.",
      blockCode: "SUBSCRIPTION_SUSPENDED",
    };
  }

  const dueAt = input.dates.subscriptionStatus === SubscriptionStatus.TRIAL
    ? input.dates.trialEndsAt ?? input.dates.renewalAt
    : input.dates.renewalAt;

  if (input.dates.subscriptionStatus === SubscriptionStatus.PAST_DUE) {
    if (graceEndsAt && now <= graceEndsAt) {
      return {
        ...base,
        effectiveStatus: SubscriptionStatus.PAST_DUE,
        operational: true,
        deadline: graceEndsAt,
        notice: `Payment is past due. Commercial access remains available until ${graceEndsAt.toLocaleDateString("en-GB")}.`,
        blockCode: null,
      };
    }
    return {
      ...base,
      effectiveStatus: SubscriptionStatus.SUSPENDED,
      operational: false,
      deadline: graceEndsAt,
      notice: "The payment grace period has ended. Renew the subscription before creating products or orders.",
      blockCode: "SUBSCRIPTION_EXPIRED",
    };
  }

  if (!dueAt || now <= dueAt) {
    const isTrial = input.dates.subscriptionStatus === SubscriptionStatus.TRIAL;
    return {
      ...base,
      effectiveStatus: input.dates.subscriptionStatus,
      operational: true,
      deadline: dueAt,
      notice: isTrial && dueAt
        ? `Trial access ends on ${dueAt.toLocaleDateString("en-GB")}.`
        : null,
      blockCode: null,
    };
  }

  if (graceEndsAt && now <= graceEndsAt) {
    return {
      ...base,
      effectiveStatus: SubscriptionStatus.PAST_DUE,
      operational: true,
      deadline: graceEndsAt,
      notice: `The subscription is awaiting renewal. Grace access ends on ${graceEndsAt.toLocaleDateString("en-GB")}.`,
      blockCode: null,
    };
  }

  return {
    ...base,
    effectiveStatus: SubscriptionStatus.SUSPENDED,
    operational: false,
    deadline: graceEndsAt ?? dueAt,
    notice: "The subscription term and grace period have ended. Renew before commercial operations continue.",
    blockCode: "SUBSCRIPTION_EXPIRED",
  };
}

async function commercialStateFromDb(db: SubscriptionDb, shopId: string, now = new Date()) {
  const [contract, shop] = await Promise.all([
    db.shopSubscriptionContract.findUnique({
      where: { shopId },
      select: {
        subscriptionStatus: true,
        trialEndsAt: true,
        renewalAt: true,
        graceEndsAt: true,
        termsSnapshot: true,
      },
    }),
    db.shop.findUnique({
      where: { id: shopId },
      select: { planTier: true, subscriptionStatus: true, subscriptionRenewalAt: true },
    }),
  ]);

  if (!shop) throw new CommercialSubscriptionError("SUBSCRIPTION_SUSPENDED", "This shop no longer exists.");

  let snapshot: SubscriptionPlanSnapshot | null = null;
  if (contract) {
    const parsed = parseSubscriptionPlanSnapshot(contract.termsSnapshot);
    snapshot = parsed.success ? parsed.data : null;
  } else {
    const plan = await db.subscriptionPlan.findUnique({ where: { tier: shop.planTier } });
    snapshot = plan ? subscriptionPlanSnapshot(plan) : null;
  }

  return deriveCommercialSubscriptionState({
    shopId,
    hasContract: Boolean(contract),
    snapshot,
    dates: contract
      ? {
          subscriptionStatus: contract.subscriptionStatus,
          trialEndsAt: contract.trialEndsAt,
          renewalAt: contract.renewalAt,
          graceEndsAt: contract.graceEndsAt,
        }
      : {
          subscriptionStatus: shop.subscriptionStatus,
          trialEndsAt: null,
          renewalAt: shop.subscriptionRenewalAt,
          graceEndsAt: null,
        },
    now,
  });
}

export async function commercialSubscriptionState(shopId: string, now = new Date()) {
  return commercialStateFromDb(platformDb, shopId, now);
}

export async function assertCommercialOperationAvailable(shopId: string, now = new Date()) {
  const state = await commercialSubscriptionState(shopId, now);
  assertOperational(state);
  return state;
}

export function subscriptionFeatureIncluded(state: CommercialSubscriptionState, feature: SubscriptionFeature) {
  if (!state.enforcementEnabled) return true;
  const features = state.snapshot?.features ?? [];
  if (!features.length) return true;
  return features.includes(feature);
}

function assertOperational(state: CommercialSubscriptionState) {
  if (!state.operational) {
    throw new CommercialSubscriptionError(
      state.blockCode ?? "SUBSCRIPTION_EXPIRED",
      state.notice ?? "The subscription is not available for commercial operations.",
    );
  }
}

function assertFeature(state: CommercialSubscriptionState, feature: SubscriptionFeature) {
  if (!subscriptionFeatureIncluded(state, feature)) {
    throw new CommercialSubscriptionError(
      "FEATURE_NOT_INCLUDED",
      `${feature.replaceAll("_", " ")} is not included in this shop's assigned plan.`,
    );
  }
}

export async function assertProductCreationAvailable(shopId: string, now = new Date()) {
  const state = await commercialStateFromDb(platformDb, shopId, now);
  assertOperational(state);
  assertFeature(state, "INVENTORY");
  const limit = state.snapshot?.maxProducts ?? null;
  if (limit !== null) {
    const count = await platformDb.product.count({ where: { shopId } });
    if (count >= limit) {
      throw new CommercialSubscriptionError(
        "PRODUCT_LIMIT_REACHED",
        `This plan allows ${limit.toLocaleString("en-GB")} products. Upgrade or remove an unused product before creating another.`,
        limit,
      );
    }
  }
  return state;
}

export async function assertOrderCreationAvailable(input: {
  shopId: string;
  channel: OrderChannel;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const state = await commercialStateFromDb(platformDb, input.shopId, now);
  assertOperational(state);
  assertFeature(state, input.channel === OrderChannel.POS ? "POS" : "STOREFRONT");
  const limit = state.snapshot?.maxOrdersPerMonth ?? null;
  if (limit !== null) {
    const { monthStart, monthEnd } = subscriptionMonthWindow(now);
    const count = await platformDb.order.count({
      where: { shopId: input.shopId, createdAt: { gte: monthStart, lt: monthEnd } },
    });
    if (count >= limit) {
      throw new CommercialSubscriptionError(
        "ORDER_LIMIT_REACHED",
        `This plan allows ${limit.toLocaleString("en-GB")} orders per month. Upgrade the plan before taking another order.`,
        limit,
      );
    }
  }
  return state;
}

export async function subscriptionUsage(shopId: string, now = new Date()): Promise<SubscriptionUsageState> {
  const state = await commercialStateFromDb(platformDb, shopId, now);
  const { monthStart, monthEnd } = subscriptionMonthWindow(now);
  const [productCount, monthlyOrderCount, activeStaff, pendingInvites] = await Promise.all([
    platformDb.product.count({ where: { shopId } }),
    platformDb.order.count({ where: { shopId, createdAt: { gte: monthStart, lt: monthEnd } } }),
    platformDb.user.count({ where: { shopId, isActive: true, role: { not: "OWNER" } } }),
    platformDb.inviteToken.count({ where: { shopId, usedAt: null, expiresAt: { gt: now } } }),
  ]);

  return {
    ...state,
    monthStart,
    monthEnd,
    productCount,
    monthlyOrderCount,
    activeStaff,
    pendingInvites,
    reservedStaff: activeStaff + pendingInvites,
    productLimit: state.snapshot?.maxProducts ?? null,
    monthlyOrderLimit: state.snapshot?.maxOrdersPerMonth ?? null,
    staffLimit: state.snapshot?.includedStaffAccounts ?? null,
  };
}

const featureByDashboardPrefix: Array<{ prefix: string; feature: SubscriptionFeature }> = [
  { prefix: "/dashboard/catalog", feature: "INVENTORY" },
  { prefix: "/dashboard/pos", feature: "POS" },
  { prefix: "/dashboard/designs", feature: "DESIGN_STUDIO" },
  { prefix: "/dashboard/suppliers", feature: "SUPPLIERS" },
  { prefix: "/dashboard/network", feature: "SHOP_NETWORK" },
  { prefix: "/dashboard/messages", feature: "CUSTOMER_MESSAGING" },
  { prefix: "/dashboard/reports", feature: "ADVANCED_REPORTS" },
  { prefix: "/dashboard/exports", feature: "ADVANCED_REPORTS" },
  { prefix: "/dashboard/commerce", feature: "STOREFRONT" },
];

export async function subscriptionAccessForDashboardPath(shopId: string, pathname: string) {
  const state = await commercialSubscriptionState(shopId);
  const feature = featureByDashboardPrefix.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.feature ?? null;
  return {
    ...state,
    feature,
    featureIncluded: feature ? subscriptionFeatureIncluded(state, feature) : true,
  };
}

export function commercialSubscriptionError(error: unknown) {
  if (error instanceof CommercialSubscriptionError) return error;
  const message = error instanceof Error ? error.message : String(error ?? "");
  const patterns: Array<[string, SubscriptionBlockCode, string]> = [
    ["EJM_SUBSCRIPTION_PRODUCT_LIMIT", "PRODUCT_LIMIT_REACHED", "The product limit for this subscription has been reached."],
    ["EJM_SUBSCRIPTION_ORDER_LIMIT", "ORDER_LIMIT_REACHED", "The monthly order limit for this subscription has been reached."],
    ["EJM_SUBSCRIPTION_FEATURE_REQUIRED", "FEATURE_NOT_INCLUDED", "This feature is not included in the assigned subscription plan."],
    ["EJM_SUBSCRIPTION_CANCELLED", "SUBSCRIPTION_CANCELLED", "This subscription has been cancelled."],
    ["EJM_SUBSCRIPTION_SUSPENDED", "SUBSCRIPTION_SUSPENDED", "This subscription is suspended."],
    ["EJM_SUBSCRIPTION_EXPIRED", "SUBSCRIPTION_EXPIRED", "The subscription term and grace period have ended."],
  ];
  const match = patterns.find(([token]) => message.includes(token));
  return match ? new CommercialSubscriptionError(match[1], match[2]) : null;
}
