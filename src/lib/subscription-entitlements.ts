import { Prisma, Role, type InviteToken, type User } from "@prisma/client";
import { platformDb } from "@/lib/platform-db";
import { parseSubscriptionPlanSnapshot, subscriptionPlanSnapshot, type SubscriptionPlanSnapshot } from "@/lib/subscription-plans";

type EntitlementTransaction = Pick<
  Prisma.TransactionClient,
  "shopSubscriptionContract" | "subscriptionPlan" | "shop" | "user" | "inviteToken"
>;

export class SubscriptionLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubscriptionLimitError";
  }
}

export class SubscriptionEntitlementError extends Error {
  constructor(public readonly code: "EMAIL_EXISTS" | "INVITE_INVALID" | "STAFF_NOT_FOUND") {
    super(code);
    this.name = "SubscriptionEntitlementError";
  }
}

async function currentShopEntitlementsFromDb(db: EntitlementTransaction, shopId: string): Promise<SubscriptionPlanSnapshot | null> {
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

async function staffCapacityFromDb(db: EntitlementTransaction, shopId: string) {
  const entitlements = await currentShopEntitlementsFromDb(db, shopId);
  const [activeStaff, pendingInvites] = await Promise.all([
    db.user.count({ where: { shopId, isActive: true, role: { not: Role.OWNER } } }),
    db.inviteToken.count({ where: { shopId, usedAt: null, expiresAt: { gt: new Date() } } }),
  ]);
  const limit = entitlements?.includedStaffAccounts ?? null;
  return staffSlotState(limit, activeStaff, pendingInvites);
}

async function assertStaffReservationAvailable(db: EntitlementTransaction, shopId: string) {
  const capacity = await staffCapacityFromDb(db, shopId);
  if (capacity.atLimit) {
    throw new SubscriptionLimitError(`This plan includes ${capacity.limit} staff account${capacity.limit === 1 ? "" : "s"}.`);
  }
  return capacity;
}

async function assertInviteCanBeAccepted(db: EntitlementTransaction, shopId: string) {
  const entitlements = await currentShopEntitlementsFromDb(db, shopId);
  const limit = entitlements?.includedStaffAccounts ?? null;
  if (limit === null) return;
  const activeStaff = await db.user.count({ where: { shopId, isActive: true, role: { not: Role.OWNER } } });
  if (activeStaff >= limit) {
    throw new SubscriptionLimitError(`This plan includes ${limit} staff account${limit === 1 ? "" : "s"}.`);
  }
}

export function staffSlotState(limit: number | null, activeStaff: number, pendingInvites: number) {
  const reserved = activeStaff + pendingInvites;
  return {
    limit,
    activeStaff,
    pendingInvites,
    reserved,
    remaining: limit === null ? null : Math.max(0, limit - reserved),
    atLimit: limit !== null && reserved >= limit,
  };
}

export async function staffCapacity(shopId: string) {
  return staffCapacityFromDb(platformDb, shopId);
}

export async function createStaffAccountWithinPlan(input: {
  shopId: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  passwordHash: string;
}): Promise<User> {
  return platformDb.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) throw new SubscriptionEntitlementError("EMAIL_EXISTS");
    await assertStaffReservationAvailable(tx, input.shopId);
    return tx.user.create({
      data: {
        shopId: input.shopId,
        name: input.name,
        email: input.email,
        phone: input.phone,
        role: input.role,
        passwordHash: input.passwordHash,
        isActive: true,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function toggleStaffAccessWithinPlan(input: { shopId: string; userId: string }): Promise<User> {
  return platformDb.$transaction(async (tx) => {
    const user = await tx.user.findFirst({ where: { id: input.userId, shopId: input.shopId } });
    if (!user) throw new SubscriptionEntitlementError("STAFF_NOT_FOUND");
    if (!user.isActive && user.role !== Role.OWNER) await assertStaffReservationAvailable(tx, input.shopId);
    return tx.user.update({
      where: { id: user.id },
      data: { isActive: !user.isActive, sessionVersion: { increment: 1 } },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function createStaffInviteWithinPlan(input: {
  shopId: string;
  email: string;
  role: Role;
  tokenHash: string;
  expiresAt: Date;
  createdById: string;
}): Promise<InviteToken> {
  return platformDb.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) throw new SubscriptionEntitlementError("EMAIL_EXISTS");
    await tx.inviteToken.updateMany({
      where: { shopId: input.shopId, email: input.email, usedAt: null },
      data: { expiresAt: new Date() },
    });
    await assertStaffReservationAvailable(tx, input.shopId);
    return tx.inviteToken.create({
      data: {
        shopId: input.shopId,
        email: input.email,
        role: input.role,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        createdById: input.createdById,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function acceptStaffInviteWithinPlan(input: {
  tokenHash: string;
  name: string;
  passwordHash: string;
}): Promise<{ user: User; invite: InviteToken }> {
  return platformDb.$transaction(async (tx) => {
    const invite = await tx.inviteToken.findUnique({ where: { tokenHash: input.tokenHash } });
    if (!invite || invite.usedAt || invite.expiresAt <= new Date()) {
      throw new SubscriptionEntitlementError("INVITE_INVALID");
    }
    const existing = await tx.user.findUnique({ where: { email: invite.email }, select: { id: true } });
    if (existing) throw new SubscriptionEntitlementError("INVITE_INVALID");
    const claimed = await tx.inviteToken.updateMany({
      where: { id: invite.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) throw new SubscriptionEntitlementError("INVITE_INVALID");
    await assertInviteCanBeAccepted(tx, invite.shopId);
    const user = await tx.user.create({
      data: {
        shopId: invite.shopId,
        email: invite.email,
        name: input.name,
        role: invite.role,
        passwordHash: input.passwordHash,
      },
    });
    return { user, invite };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
