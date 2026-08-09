import { readFileSync } from "node:fs";
import {
  ProductionInventoryKind,
  ProductionInventoryMovementType,
  ProductionInventoryUnit,
} from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  calculateProductionCost,
  inventoryMovementDelta,
  productionInventoryKey,
  weightedUnitCost,
} from "@/lib/production-inventory";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("Phase 14 stock, purchasing and production costing", () => {
  it("keeps garment colour/size and vinyl resources as exact inventory identities", () => {
    const medium = productionInventoryKey({
      kind: ProductionInventoryKind.GARMENT,
      unit: ProductionInventoryUnit.PIECE,
      name: "Black team tee",
      colour: "Black",
      size: "M",
      sourceResourceId: "garment-black-tee",
    });
    const large = productionInventoryKey({
      kind: ProductionInventoryKind.GARMENT,
      unit: ProductionInventoryUnit.PIECE,
      name: "Black team tee",
      colour: "Black",
      size: "L",
      sourceResourceId: "garment-black-tee",
    });
    const vinyl = productionInventoryKey({
      kind: ProductionInventoryKind.VINYL,
      unit: ProductionInventoryUnit.METRE,
      name: "Premium HTV",
      colour: "White",
      sourceResourceId: "material-white-htv",
    });
    expect(medium).not.toBe(large);
    expect(vinyl).toContain("VINYL|METRE|resource:material-white-htv");
  });

  it("signs incoming and outgoing stock movements correctly", () => {
    expect(inventoryMovementDelta(ProductionInventoryMovementType.PURCHASE_RECEIPT, 4)).toBe(4);
    expect(inventoryMovementDelta(ProductionInventoryMovementType.ADJUSTMENT_IN, 2)).toBe(2);
    expect(inventoryMovementDelta(ProductionInventoryMovementType.PRODUCTION_USE, 0.45)).toBe(-0.45);
    expect(inventoryMovementDelta(ProductionInventoryMovementType.WASTE, 0.1)).toBe(-0.1);
    expect(inventoryMovementDelta(ProductionInventoryMovementType.SUPPLIER_RETURN, 1)).toBe(-1);
  });

  it("uses weighted average cost when new production stock is received", () => {
    expect(weightedUnitCost({
      currentQuantity: 3,
      currentUnitCost: 12,
      receivedQuantity: 2,
      receivedUnitCost: 14,
    })).toBeCloseTo(12.8, 8);
  });

  it("calculates true production cost, profit and margin from real inputs", () => {
    const result = calculateProductionCost({
      garmentCost: 25,
      materialUnitCost: 12.8,
      materialUsedMetres: 0.5,
      materialWasteMetres: 0.1,
      labourCost: 5,
      designCharge: 3,
      pressingCharge: 2,
      additionalServicesCost: 1,
      revenue: 80,
    });
    expect(result.materialCost).toBeCloseTo(6.4, 8);
    expect(result.wasteCost).toBeCloseTo(1.28, 8);
    expect(result.totalCost).toBeCloseTo(43.68, 8);
    expect(result.profit).toBeCloseTo(36.32, 8);
    expect(result.marginPercent).toBeCloseTo(45.4, 8);
  });

  it("adds stock and cost ledgers without destructive production-data migration", () => {
    const migration = source("../../prisma/migrations/20260809110000_phase14_stock_purchasing_production_costing/migration.sql");
    const links = source("../../prisma/migrations/20260809110500_phase14_production_purchase_links/migration.sql");
    expect(migration).toContain('CREATE TABLE "ProductionInventoryItem"');
    expect(migration).toContain('CREATE TABLE "ProductionInventoryMovement"');
    expect(migration).toContain('CREATE TABLE "SupplierGoodsReceipt"');
    expect(migration).toContain('CREATE TABLE "SupplierCostRecord"');
    expect(migration).toContain('CREATE TABLE "SupplierAccountEntry"');
    expect(migration).toContain('CREATE TABLE "SupplierStockReturn"');
    expect(migration).toContain('CREATE TABLE "ProductionCostSnapshot"');
    expect(links).toContain('CREATE TABLE "ProductionPurchaseLink"');
    expect(`${migration}\n${links}`).not.toContain("DROP TABLE");
    expect(`${migration}\n${links}`).not.toContain("DELETE FROM");
    expect(`${migration}\n${links}`).not.toContain('ALTER TABLE "DesignProductionBrief"');
  });

  it("serializes stock mutations and prevents negative balances", () => {
    const helper = source("../lib/production-inventory.ts");
    expect(helper).toContain('FOR UPDATE');
    expect(helper).toContain('AND "shopId" = ${input.shopId}');
    expect(helper).toContain('if (nextQuantity < -0.0001)');
    expect(helper).toContain("existingAfterLock");
    expect(helper).toContain("idempotencyKey");
  });

  it("extends existing purchase orders instead of creating a second purchasing system", () => {
    const suppliers = source("../app/dashboard/suppliers/actions.ts");
    expect(suppliers).toContain("productionPurchaseLink.create");
    expect(suppliers).toContain("ProductionInventoryMovementType.PURCHASE_RECEIPT");
    expect(suppliers).toContain("updateWeightedCost: true");
    expect(suppliers).toContain("supplierGoodsReceipt.create");
    expect(suppliers).toContain("supplierCostRecord.create");
    expect(suppliers).toContain("SupplierAccountEntryType.PURCHASE");
    expect(suppliers).toContain("productVariant.update");
    expect(suppliers).toContain("where: { id: parsed.data.productionInventoryItemId, shopId, isActive: true }");
  });

  it("separates costing from stock posting and makes production consumption idempotent", () => {
    const actions = source("../app/dashboard/production-stock/actions.ts");
    expect(actions).toContain("calculateProductionCost");
    expect(actions).toContain("if (existing?.inventoryPostedAt)");
    expect(actions).toContain('idempotencyKey: `production-cost:${cost.id}:garment`');
    expect(actions).toContain('idempotencyKey: `production-cost:${cost.id}:material`');
    expect(actions).toContain('idempotencyKey: `production-cost:${cost.id}:waste`');
    expect(actions).toContain("inventoryPostedAt: new Date()");
    expect(actions).toContain("ProductionInventoryMovementType.SUPPLIER_RETURN");
    expect(actions).toContain("SupplierAccountEntryType.RETURN_CREDIT");
    expect(actions).toContain("SupplierAccountEntryType.PAYMENT");
  });

  it("exposes true cost, supplier balances, exact stock and separate posting in the workspace", () => {
    const page = source("../app/dashboard/production-stock/page.tsx");
    expect(page).toContain("Production stock & true job cost");
    expect(page).toContain("Exact size");
    expect(page).toContain("Supplier balances & payments");
    expect(page).toContain("Return stock to supplier");
    expect(page).toContain("True cost & profit by reviewed production job");
    expect(page).toContain("Saving a cost estimate never changes stock");
    expect(page).toContain("Post garment, material use and waste to stock");
  });
});
