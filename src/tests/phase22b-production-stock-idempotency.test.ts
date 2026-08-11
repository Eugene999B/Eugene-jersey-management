import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("Phase 22B production stock exactly-once accounting", () => {
  test("supplier payment and return records have durable per-shop idempotency keys", () => {
    const model = source("prisma/models/production-inventory.prisma");
    const migration = source("prisma/migrations/20260811220000_phase22b_production_stock_idempotency/migration.sql");

    expect(model).toContain("model SupplierAccountEntry");
    expect(model).toContain("model SupplierStockReturn");
    expect((model.match(/idempotencyKey\s+String\?/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect((model.match(/@@unique\(\[shopId, idempotencyKey\]\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(migration).toContain('ALTER TABLE "SupplierAccountEntry"');
    expect(migration).toContain('ALTER TABLE "SupplierStockReturn"');
    expect(migration).toContain('CREATE UNIQUE INDEX "SupplierAccountEntry_shopId_idempotencyKey_key"');
    expect(migration).toContain('CREATE UNIQUE INDEX "SupplierStockReturn_shopId_idempotencyKey_key"');
  });

  test("manual adjustments, supplier payments and supplier returns require a submission id", () => {
    const actions = source("src/app/dashboard/production-stock/actions.ts");

    expect(actions).toContain("const submissionIdSchema = z.string().uuid()");
    expect((actions.match(/submissionId: submissionIdSchema/g) ?? []).length).toBe(3);
    expect(actions).toContain('const idempotencyKey = `manual-adjustment:${parsed.data.submissionId}`');
    expect(actions).toContain('const idempotencyKey = `supplier-payment:${parsed.data.submissionId}`');
    expect(actions).toContain('const idempotencyKey = `supplier-return:${parsed.data.submissionId}`');
  });

  test("consequential accounting writes serialize and skip replay audits", () => {
    const actions = source("src/app/dashboard/production-stock/actions.ts");

    expect(actions).toContain("async function lockShopSubmission");
    expect(actions).toContain('SELECT "id"');
    expect(actions).toContain("FOR UPDATE");
    expect((actions.match(/await lockShopSubmission\(tx, shopId\)/g) ?? []).length).toBe(3);
    expect(actions).toContain("if (existing) return { movement: existing, created: false }");
    expect(actions).toContain("if (existing) return { entry: existing, created: false }");
    expect(actions).toContain("if (existing) return { row: existing, created: false }");
    expect((actions.match(/if \(result\.created\)/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  test("supplier return ties return, stock movement and supplier credit to one replay key", () => {
    const actions = source("src/app/dashboard/production-stock/actions.ts");

    expect(actions).toContain("idempotencyKey,\n          createdById: session.id");
    expect(actions).toContain('idempotencyKey: `${idempotencyKey}:stock`');
    expect(actions).toContain('idempotencyKey: `${idempotencyKey}:credit`');
  });

  test("production cost posting remains exactly once including its audit event", () => {
    const actions = source("src/app/dashboard/production-stock/actions.ts");

    expect(actions).toContain("if (cost.inventoryPostedAt) return { posted: cost, created: false }");
    expect(actions).toContain("return { posted, created: true }");
    expect(actions).toContain('action: "production.cost.inventory-posted"');
  });

  test("production stock forms use per-render tokens, pending-safe buttons and role-correct costing controls", () => {
    const page = source("src/app/dashboard/production-stock/page.tsx");

    expect(page).toContain('import { randomUUID } from "node:crypto"');
    expect((page.match(/name="submissionId" value=\{randomUUID\(\)\}/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(page).toContain("ConfirmActionButton");
    expect(page).toContain("<Button><PackageCheck size={16} /> Add stock item</Button>");
    expect(page).toContain("const canCost = [Role.OWNER, Role.MANAGER, Role.ACCOUNTANT].includes(session.role)");
    expect(page).toContain("canCost && !cost?.inventoryPostedAt");
    expect(page).toContain("canCost && cost && !cost.inventoryPostedAt");
    expect(page).toContain("Costing and production-stock posting are managed by the owner, manager or accountant.");
  });
});
