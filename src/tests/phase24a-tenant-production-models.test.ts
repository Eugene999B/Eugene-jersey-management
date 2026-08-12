import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const directProductionModels = [
  "DesignJobVersion",
  "DesignProductionBrief",
  "HeatPressRun",
  "HeatPressEvent",
  "HeatPressEvidence",
  "CustomerProductionRequest",
  "CustomerProductionAsset",
  "CustomerProductionEvent",
  "PaymentRefund",
  "ProductionInventoryItem",
  "ProductionInventoryMovement",
  "ProductionPurchaseLink",
  "SupplierGoodsReceipt",
  "SupplierCostRecord",
  "SupplierAccountEntry",
  "SupplierStockReturn",
  "ProductionCostSnapshot",
] as const;

const delegateNames = [
  "designJobVersion",
  "designProductionBrief",
  "heatPressRun",
  "heatPressEvent",
  "heatPressEvidence",
  "customerProductionRequest",
  "customerProductionAsset",
  "customerProductionEvent",
  "paymentRefund",
  "productionInventoryItem",
  "productionInventoryMovement",
  "productionPurchaseLink",
  "supplierGoodsReceipt",
  "supplierCostRecord",
  "supplierAccountEntry",
  "supplierStockReturn",
  "productionCostSnapshot",
] as const;

describe("Phase 24A production-era tenant boundary", () => {
  it("keeps one tenant request context singleton in every environment", () => {
    const context = source("../lib/tenant-context.ts");
    expect(context).toContain("globalForTenantContext.tenantRequestContext = tenantRequestContext");
    expect(context).not.toContain('process.env.NODE_ENV !== "production"');
  });

  it("registers every production-era shop-owned model as direct tenant data", () => {
    const tenantDb = source("../lib/tenant-db.ts");
    for (const model of directProductionModels) {
      expect(tenantDb, `${model} is missing from direct tenant policy`).toContain(`\"${model}\"`);
    }
  });

  it("maps every production-era Prisma delegate before fail-closed unknown-delegate handling", () => {
    const tenantDb = source("../lib/tenant-db.ts");
    for (const delegate of delegateNames) {
      expect(tenantDb, `${delegate} is missing from tenant delegate mapping`).toContain(`${delegate}:`);
    }
    expect(tenantDb).toContain("blockedUnknownDelegate");
  });

  it("keeps raw SQL blocked in tenant transactions and uses tenant-safe inventory concurrency", () => {
    const tenantDb = source("../lib/tenant-db.ts");
    const inventory = source("../lib/production-inventory.ts");
    expect(tenantDb).toContain('"$queryRaw"');
    expect(tenantDb).toContain("is not allowed inside a tenant transaction");
    expect(inventory).not.toMatch(/\$(?:queryRaw|executeRaw)/);
    expect(inventory).toContain("updatedAt: item.updatedAt");
    expect(inventory).toContain("if (updated.count !== 1) continue");
  });
});
