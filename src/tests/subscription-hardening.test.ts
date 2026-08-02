import { OrderChannel, SubscriptionStatus } from "@prisma/client";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  deriveCommercialSubscriptionState,
  subscriptionFeatureIncluded,
  subscriptionMonthWindow,
} from "@/lib/subscription-hardening";
import type { SubscriptionPlanSnapshot } from "@/lib/subscription-plans";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

function snapshot(overrides: Partial<SubscriptionPlanSnapshot> = {}): SubscriptionPlanSnapshot {
  return {
    tier: "BASIC",
    name: "Basic",
    description: "Commercial starter plan",
    currency: "GHS",
    monthlyPrice: "150.00",
    yearlyPrice: "1500.00",
    trialDays: 14,
    gracePeriodDays: 7,
    includedStaffAccounts: 3,
    maxProducts: 50,
    maxOrdersPerMonth: 200,
    features: ["STOREFRONT", "POS", "INVENTORY"],
    isConfigured: true,
    isPublic: true,
    isActive: true,
    version: 2,
    ...overrides,
  };
}

function state(input: {
  status: SubscriptionStatus;
  now: string;
  trialEndsAt?: string | null;
  renewalAt?: string | null;
  graceEndsAt?: string | null;
  hasContract?: boolean;
  snapshot?: SubscriptionPlanSnapshot | null;
}) {
  return deriveCommercialSubscriptionState({
    shopId: "shop-one",
    hasContract: input.hasContract ?? true,
    snapshot: input.snapshot === undefined ? snapshot() : input.snapshot,
    dates: {
      subscriptionStatus: input.status,
      trialEndsAt: input.trialEndsAt ? new Date(input.trialEndsAt) : null,
      renewalAt: input.renewalAt ? new Date(input.renewalAt) : null,
      graceEndsAt: input.graceEndsAt ? new Date(input.graceEndsAt) : null,
    },
    now: new Date(input.now),
  });
}

describe("commercial subscription lifecycle", () => {
  it("preserves legacy access until a configured contract is explicitly assigned", () => {
    const legacy = state({
      status: SubscriptionStatus.TRIAL,
      now: "2026-07-29T08:00:00.000Z",
      hasContract: false,
      snapshot: snapshot({ isConfigured: false }),
    });
    expect(legacy.enforcementEnabled).toBe(false);
    expect(legacy.operational).toBe(true);
    expect(legacy.notice).toContain("legacy access");
  });

  it("keeps an active trial operational before its deadline", () => {
    const trial = state({
      status: SubscriptionStatus.TRIAL,
      now: "2026-07-29T08:00:00.000Z",
      trialEndsAt: "2026-08-05T08:00:00.000Z",
    });
    expect(trial.effectiveStatus).toBe(SubscriptionStatus.TRIAL);
    expect(trial.operational).toBe(true);
    expect(trial.deadline?.toISOString()).toBe("2026-08-05T08:00:00.000Z");
  });

  it("derives past-due grace access after a trial or renewal deadline", () => {
    const grace = state({
      status: SubscriptionStatus.ACTIVE,
      now: "2026-08-03T08:00:00.000Z",
      renewalAt: "2026-08-01T08:00:00.000Z",
    });
    expect(grace.effectiveStatus).toBe(SubscriptionStatus.PAST_DUE);
    expect(grace.operational).toBe(true);
    expect(grace.graceEndsAt?.toISOString()).toBe("2026-08-08T08:00:00.000Z");
  });

  it("blocks commercial operations after the grace period", () => {
    const expired = state({
      status: SubscriptionStatus.PAST_DUE,
      now: "2026-08-09T08:00:00.000Z",
      renewalAt: "2026-08-01T08:00:00.000Z",
      graceEndsAt: "2026-08-08T08:00:00.000Z",
    });
    expect(expired.effectiveStatus).toBe(SubscriptionStatus.SUSPENDED);
    expect(expired.operational).toBe(false);
    expect(expired.blockCode).toBe("SUBSCRIPTION_EXPIRED");
  });

  it("always blocks cancelled contracts", () => {
    const cancelled = state({
      status: SubscriptionStatus.CANCELLED,
      now: "2026-07-29T08:00:00.000Z",
    });
    expect(cancelled.operational).toBe(false);
    expect(cancelled.blockCode).toBe("SUBSCRIPTION_CANCELLED");
  });

  it("uses a stable UTC calendar-month window for order limits", () => {
    expect(subscriptionMonthWindow(new Date("2026-07-29T23:59:59.000Z"))).toEqual({
      monthStart: new Date("2026-07-01T00:00:00.000Z"),
      monthEnd: new Date("2026-08-01T00:00:00.000Z"),
    });
  });

  it("enforces explicit feature lists while retaining empty legacy lists", () => {
    const configured = state({ status: SubscriptionStatus.ACTIVE, now: "2026-07-29T08:00:00.000Z", renewalAt: "2026-08-29T08:00:00.000Z" });
    expect(subscriptionFeatureIncluded(configured, "POS")).toBe(true);
    expect(subscriptionFeatureIncluded(configured, "DESIGN_STUDIO")).toBe(false);

    const coreOnly = { ...configured, snapshot: snapshot({ features: ["STOREFRONT"] }) };
    expect(subscriptionFeatureIncluded(coreOnly, "POS")).toBe(true);
    expect(subscriptionFeatureIncluded(coreOnly, "INVENTORY")).toBe(true);
    expect(subscriptionFeatureIncluded(coreOnly, "SUPPLIERS")).toBe(false);

    const legacyFeatures = { ...configured, snapshot: snapshot({ features: [] }) };
    expect(subscriptionFeatureIncluded(legacyFeatures, "DESIGN_STUDIO")).toBe(true);
  });
});

describe("subscription enforcement architecture", () => {
  it("keeps one shared preflight in every product and customer-order creation path", () => {
    const catalog = source("../app/dashboard/catalog/actions.ts");
    const pos = source("../app/api/pos/checkout/route.ts");
    const publicOrder = source("../app/api/public-order/route.ts");
    const cart = source("../app/cart/actions.ts");

    expect(catalog).toContain("assertProductCreationAvailable");
    expect(pos).toContain("assertOrderCreationAvailable");
    expect(pos).toContain("OrderChannel.POS");
    expect(publicOrder).toContain("assertOrderCreationAvailable");
    expect(publicOrder).toContain("OrderChannel.ONLINE");
    expect(cart).toContain("assertOrderCreationAvailable");
    expect(cart).toContain("OrderChannel.ONLINE");
    expect(OrderChannel.POS).toBe("POS");
  });

  it("adds a transactional database backstop for concurrent product and order creation", () => {
    const migration = source("../../prisma/migrations/20260729075500_release37_subscription_enforcement/migration.sql");
    expect(migration).toContain('CREATE TRIGGER "Product_subscription_limit"');
    expect(migration).toContain('CREATE TRIGGER "Order_subscription_limit"');
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("EJM_SUBSCRIPTION_PRODUCT_LIMIT");
    expect(migration).toContain("EJM_SUBSCRIPTION_ORDER_LIMIT");
    expect(migration).toContain("EJM_SUBSCRIPTION_FEATURE_REQUIRED");
    expect(migration).toContain("EJM_SUBSCRIPTION_EXPIRED");
  });

  it("gates dashboard features and exposes owner and administrator usage views", () => {
    const layout = source("../app/dashboard/layout.tsx");
    const tenantPage = source("../app/dashboard/subscription/page.tsx");
    const adminBilling = source("../app/admin/billing/page.tsx");

    expect(layout).toContain("subscriptionAccessForDashboardPath");
    expect(layout).toContain("featureIncluded");
    expect(layout).toContain("businessModuleForDashboardPath");
    expect(tenantPage).toContain("Subscription &amp; usage");
    expect(tenantPage).toContain("Orders created this calendar month");
    expect(adminBilling).toContain("usageLabel");
    expect(adminBilling).toContain("Orders this month");
  });

  it("provides an auditable lifecycle processor and production command", () => {
    const lifecycle = source("../../scripts/process-subscription-lifecycle.ts");
    const packageJson = source("../../package.json");
    expect(lifecycle).toContain("system.subscription_lifecycle_updated");
    expect(lifecycle).toContain("deriveCommercialSubscriptionState");
    expect(packageJson).toContain('"jobs:subscriptions"');
  });
});
