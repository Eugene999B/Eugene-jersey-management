import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("Phase 19C production cancellation", () => {
  it("cancels an unpaid started online order without inventing sellable stock", () => {
    const route = source("src/app/api/orders/[orderId]/status/route.ts");
    expect(route).toContain("stockReleased: false, productionStarted: true");
    expect(route).toContain("orders.production_cancelled");
    expect(route).toContain("status: PaymentStatus.FAILED");
    expect(route).not.toContain("use the production cancellation workflow so consumed stock and waste stay accurate");
  });

  it("still forces paid online orders through refund/return handling", () => {
    const route = source("src/app/api/orders/[orderId]/status/route.ts");
    expect(route).toContain("Paid online orders require the refund/return workflow before cancellation.");
  });
});

describe("Phase 19C posted production evidence", () => {
  it("makes posted production cost fields immutable at the database boundary", () => {
    const migration = source("prisma/migrations/20260811172500_phase19c_lock_posted_production_cost/migration.sql");
    expect(migration).toContain('OLD."inventoryPostedAt" IS NOT NULL');
    expect(migration).toContain("POSTED_PRODUCTION_COST_IMMUTABLE");
    expect(migration).toContain('BEFORE UPDATE ON "ProductionCostSnapshot"');
  });
});

describe("Phase 19C heat press state serialization", () => {
  it("locks the run row before evaluating and applying a production step", () => {
    const route = source("src/app/api/heat-press-runs/[runId]/action/route.ts");
    expect(route).toContain('FROM "HeatPressRun"');
    expect(route).toContain("FOR UPDATE");
    expect(route).toContain('WHERE "id" =');
    expect(route).toContain('AND "shopId" =');
  });
});
