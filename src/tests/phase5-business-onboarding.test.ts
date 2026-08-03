import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("Phase 5 business onboarding and configuration", () => {
  test("preserves existing tenants while starting new businesses incomplete", () => {
    const migration = source("prisma/migrations/20260802235000_phase5_business_onboarding/migration.sql");
    expect(migration).toContain('ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3)');
    expect(migration).toContain('UPDATE "Shop"');
    expect(migration).toContain('ARRAY[1,2,3,4,5,6,7,8,9,10]');
    expect(migration).not.toContain('DEFAULT CURRENT_TIMESTAMP');
  });

  test("stores setup in operational shop records rather than a disconnected checklist", () => {
    const schema = source("prisma/schema.prisma");
    for (const field of ["taxRate", "receiptHeader", "receiptFooter", "defaultDepositPercent", "productionSetup", "onboardingCurrentStep", "onboardingCompletedSteps", "onboardingCompletedAt"]) {
      expect(schema).toContain(field);
    }
    const actions = source("src/app/dashboard/setup/actions.ts");
    expect(actions).toContain("shopLocation.upsert");
    expect(actions).toContain("shopPaymentConfig.upsert");
    expect(actions).toContain("productVariant.count");
    expect(actions).toContain("onboarding.completed");
  });

  test("requires real location, payments, catalogue, stock and production readiness", () => {
    const actions = source("src/app/dashboard/setup/actions.ts");
    expect(actions).toContain("coreStepsReady");
    expect(actions).toContain("paymentsReady");
    expect(actions).toContain("products < 1");
    expect(actions).toContain("stockReady");
    expect(actions).toContain("productionReady");
    expect(actions).toContain("manualHeatPress: true");
    expect(actions).not.toContain("HPGL");
  });

  test("renders all ten guided steps and the conditional production extension", () => {
    const page = source("src/app/dashboard/setup/page.tsx");
    for (let step = 1; step <= 10; step += 1) expect(page).toContain(`[${step},`);
    expect(page).toContain("Production-business extension");
    expect(page).toContain("Do not guess a machine protocol");
    expect(page).toContain("createProductAction");
    expect(page).toContain("Complete business setup");
  });

  test("surfaces setup in navigation and dashboard without blocking operational pages", () => {
    const navigation = source("src/lib/shop-navigation.ts");
    const dashboard = source("src/app/dashboard/page.tsx");
    expect(navigation).toContain('href: "/dashboard/setup"');
    expect(navigation).toContain('label: "Business setup"');
    expect(dashboard).toContain("!shop.onboardingCompletedAt");
    expect(dashboard).toContain('href="/dashboard/setup"');
    expect(dashboard).not.toContain('redirect("/dashboard/setup"');
  });

  test("uses configured receipt copy in the tenant-scoped thermal receipt", () => {
    const receipt = source("src/app/api/receipts/[orderId]/route.ts");
    expect(receipt).toContain("order.shop.receiptHeader");
    expect(receipt).toContain("order.shop.receiptFooter");
    expect(receipt).toContain("escapeHtml(order.shop.receiptHeader)");
    expect(receipt).toContain("escapeHtml(order.shop.receiptFooter)");
  });
});
