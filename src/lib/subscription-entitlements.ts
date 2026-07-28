import { Role, type Prisma } from "@prisma/client";
import { parseSubscriptionPlanSnapshot, subscriptionPlanSnapshot, type SubscriptionPlanSnapshot } from "@/lib/subscription-plans";

type EntitlementDb = Pick<
  Prisma.TransactionClient,
  "shopSubscriptionContract" | "subscriptionPlan" | "shop" | "user" | "inviteToken"
>;

export class SubscriptionLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubscriptionLimitError";
  }
}

export async function currentShopEntitlements(db: EntitlementDb, shopId: string): Promise<SubscriptionPlanSnapshot | null> {
  const contract = await db.shopSubscriptionContract.findUnique({
    where: { shopId },
    select: { termsSnapshot: true },
  });
  if (contract) {
    const parsed = parseSubscriptionPlanSnapshot(contract.termsSnapshot);
    if (parsed.success) return parsed.data;
  }

  const shop = await db.shop.findUnique({ where: { id: shopId }, select: { planTier: true } });
  if (!shop) return null;
  const plan = await db.subscriptionPlan.findUnique({ where: { tier: shop.planTier } });
  return plan ? subscriptionPlanSnapshot(plan) : null;
}

export async function staffCapacity(db: EntitlementDb, shopId: string) {
  const entitlements = await currentShopEntitlements(db, shopId);
  const [activeStaff, pendingInvites] = await Promise.all([
    db.user.count({ where: { shopId, isActive: true, role: { not: Role.OWNER } } }),
    db.inviteToken.count({ where: { shopId, usedAt: null, expiresAt: { gt: new Date() } } }),
  ]);
  const limit = entitlements?.includedStaffAccounts ?? null;
  return {
    limit,
    activeStaff,
    pendingInvites,
    reserved: activeStaff + pendingInvites,
    remaining: limit === null ? null : Math.max(0, limit - activeStaff - pendingInvites),
  };
}

export async function assertStaffReservationAvailable(db: EntitlementDb, shopId: string) {
  const capacity = await staffCapacity(db, shopId);
  if (capacity.limit !== null && capacity.reserved >= capacity.limit) {
    throw new SubscriptionLimitError(`This plan includes ${capacity.limit} staff account${capacity.limit === 1 ? "" : "s"}.`);
  }
  return capacity;
}

export async function assertInviteCanBeAccepted(db: EntitlementDb, shopId: string) {
  const entitlements = await currentShopEntitlements(db, shopId);
  const limit = entitlements?.includedStaffAccounts ?? null;
  if (limit === null) return;
  const activeStaff = await db.user.count({ where: { shopId, isActive: true, role: { not: Role.OWNER } } });
  if (activeStaff >= limit) {
    throw new SubscriptionLimitError(`This plan includes ${limit} staff account${limit === 1 ? "" : "s"}.`);
  }
}
