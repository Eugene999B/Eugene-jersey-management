import { BillingCycle, PlanTier, Prisma, SubscriptionStatus, type SubscriptionPlan } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { staffSlotState } from "@/lib/subscription-entitlements";
import {
  DEFAULT_PLAN_CATALOGUE,
  resolvePlanPrice,
  subscriptionDates,
  subscriptionPlanSnapshot,
} from "@/lib/subscription-plans";

function plan(overrides: Partial<SubscriptionPlan> = {}): SubscriptionPlan {
  const now = new Date("2026-07-28T00:00:00.000Z");
  return {
    id: "plan-basic",
    tier: PlanTier.BASIC,
    name: "Basic",
    description: "Approved starter operations",
    currency: "GHS",
    monthlyPrice: new Prisma.Decimal("150.00"),
    yearlyPrice: new Prisma.Decimal("1500.00"),
    trialDays: 14,
    gracePeriodDays: 7,
    includedStaffAccounts: 3,
    maxProducts: 500,
    maxOrdersPerMonth: 1000,
    features: ["POS", "INVENTORY"],
    isConfigured: true,
    isPublic: true,
    isActive: true,
    version: 4,
    createdById: "admin-a",
    updatedById: "admin-b",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("subscription plan catalogue", () => {
  it("creates fixed tier placeholders without inventing commercial prices", () => {
    expect(DEFAULT_PLAN_CATALOGUE.map((item) => item.tier)).toEqual([
      PlanTier.FREE,
      PlanTier.BASIC,
      PlanTier.PRO,
      PlanTier.ENTERPRISE,
    ]);
    for (const item of DEFAULT_PLAN_CATALOGUE) {
      expect(item).not.toHaveProperty("monthlyPrice");
      expect(item).not.toHaveProperty("yearlyPrice");
      expect(item.description).toContain("placeholder");
    }
  });

  it("keeps immutable version snapshots while the sole administrator saves directly", () => {
    const snapshot = subscriptionPlanSnapshot(plan({ updatedById: "admin-a", version: 5 }));
    expect(snapshot.version).toBe(5);
    expect(snapshot.monthlyPrice).toBe("150.00");
    expect(snapshot.yearlyPrice).toBe("1500.00");
  });


  it("serializes an immutable approved plan snapshot with decimal prices", () => {
    expect(subscriptionPlanSnapshot(plan())).toEqual({
      tier: PlanTier.BASIC,
      name: "Basic",
      description: "Approved starter operations",
      currency: "GHS",
      monthlyPrice: "150.00",
      yearlyPrice: "1500.00",
      trialDays: 14,
      gracePeriodDays: 7,
      includedStaffAccounts: 3,
      maxProducts: 500,
      maxOrdersPerMonth: 1000,
      features: ["POS", "INVENTORY"],
      isConfigured: true,
      isPublic: true,
      isActive: true,
      version: 4,
    });
    expect(resolvePlanPrice(plan(), BillingCycle.MONTHLY)).toBe("150.00");
    expect(resolvePlanPrice(plan(), BillingCycle.YEARLY)).toBe("1500.00");
  });

  it("derives trial and past-due grace dates from approved plan terms", () => {
    const now = new Date("2026-07-28T12:00:00.000Z");
    const trial = subscriptionDates({ status: SubscriptionStatus.TRIAL, trialDays: 14, gracePeriodDays: 7, now });
    expect(trial.trialEndsAt?.toISOString()).toBe("2026-08-11T12:00:00.000Z");
    expect(trial.renewalAt?.toISOString()).toBe("2026-08-11T12:00:00.000Z");
    expect(trial.graceEndsAt).toBeNull();

    const renewalAt = new Date("2026-08-31T12:00:00.000Z");
    const pastDue = subscriptionDates({ status: SubscriptionStatus.PAST_DUE, trialDays: 14, gracePeriodDays: 7, renewalAt, now });
    expect(pastDue.trialEndsAt).toBeNull();
    expect(pastDue.renewalAt).toEqual(renewalAt);
    expect(pastDue.graceEndsAt?.toISOString()).toBe("2026-09-07T12:00:00.000Z");
  });

  it("reserves included staff slots for both active accounts and open invites", () => {
    expect(staffSlotState(3, 1, 1)).toEqual({
      limit: 3,
      activeStaff: 1,
      pendingInvites: 1,
      reserved: 2,
      remaining: 1,
      atLimit: false,
    });
    expect(staffSlotState(3, 2, 1).atLimit).toBe(true);
    expect(staffSlotState(null, 500, 500).atLimit).toBe(false);
  });
});
