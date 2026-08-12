import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("Phase 22B exactly-once production stock accounting", () => {
  it("adds nullable per-shop idempotency keys without rewriting historical rows", () => {
    const schema = source("../../prisma/models/production-inventory.prisma");
    const migration = source("../../prisma/migrations/20260811220000_phase22b_production_stock_idempotency/migration.sql");
    expect(schema.match(/idempotencyKey\s+String\?/g)?.length).toBeGreaterThanOrEqual(3);
    expect(schema.match(/@@unique\(\[shopId, idempotencyKey\]\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(migration).toContain('ALTER TABLE "SupplierAccountEntry"');
    expect(migration).toContain('ALTER TABLE "SupplierStockReturn"');
    expect(migration).toContain("CREATE UNIQUE INDEX");
    expect(migration).not.toContain("DROP TABLE");
    expect(migration).not.toContain("DELETE FROM");
  });

  it("uses UUID submission identities for all manually consequential production-stock actions", () => {
    const actions = source("../app/dashboard/production-stock/actions.ts");
    const page = source("../app/dashboard/production-stock/page.tsx");
    expect(actions).toContain("const submissionIdSchema = z.string().uuid()");
    expect((actions.match(/submissionId: submissionIdSchema/g) ?? []).length).toBe(3);
    expect(actions).toContain("manual-adjustment:");
    expect(actions).toContain("supplier-payment:");
    expect(actions).toContain("supplier-return:");
    expect((page.match(/name=\"submissionId\"/g) ?? []).length).toBe(3);
    expect(page).toContain("randomUUID()");
  });

  it("keeps server actions tenant-safe and rejects raw locking bypasses", () => {
    const actions = source("../app/dashboard/production-stock/actions.ts");
    expect(actions).not.toMatch(/\$(?:queryRaw|executeRaw)/);
    expect(actions).not.toContain("lockShopSubmission");
    expect(actions).toContain("Prisma.PrismaClientKnownRequestError");
    expect(actions).toContain('error.code === "P2002"');
    expect(actions).toContain("IDEMPOTENCY_CONFLICT");
  });

  it("reports whether an inventory movement was created or replayed so audits stay truthful", () => {
    const helper = source("../lib/production-inventory.ts");
    const actions = source("../app/dashboard/production-stock/actions.ts");
    expect(helper).toContain("return { movement: existing, created: false }");
    expect(helper).toContain("return { movement, created: true }");
    expect(actions).toContain("if (result.created)");
    expect(actions).toContain('action: "production.stock.adjusted"');
  });

  it("binds one supplier return token to its return row, stock movement and account credit", () => {
    const actions = source("../app/dashboard/production-stock/actions.ts");
    expect(actions).toContain('idempotencyKey: `${idempotencyKey}:stock`');
    expect(actions).toContain('idempotencyKey: `${idempotencyKey}:credit`');
    const returnRow = actions.indexOf("const row = await tx.supplierStockReturn.create");
    const stockMove = actions.indexOf("await applyProductionInventoryMovement(tx", returnRow);
    const credit = actions.indexOf("await tx.supplierAccountEntry.create", stockMove);
    expect(returnRow).toBeGreaterThan(-1);
    expect(stockMove).toBeGreaterThan(returnRow);
    expect(credit).toBeGreaterThan(stockMove);
  });

  it("allows only costing roles to post production consumption and claims posting once", () => {
    const actions = source("../app/dashboard/production-stock/actions.ts");
    const start = actions.indexOf("export async function postProductionInventoryAction");
    const postAction = actions.slice(start);
    expect(postAction).toContain("await requireRole(costingRoles)");
    expect(postAction).not.toContain("await stockSession()");
    expect(postAction).toContain("inventoryPostedAt: null");
    expect(postAction).toContain("claimed.count === 1");
    expect(postAction).toContain("if (result.created)");
  });

  it("uses pending-safe confirmations for the high-consequence controls", () => {
    const page = source("../app/dashboard/production-stock/page.tsx");
    expect(page).toContain("ConfirmActionButton");
    expect(page).toContain("Record this manual production-stock movement?");
    expect(page).toContain("Record this supplier payment now?");
    expect(page).toContain("Return this stock to the supplier now?");
    expect(page).toContain("Post this reviewed job to production stock now?");
    expect(page).toContain("Costing and production-stock posting are managed by the owner, manager or accountant.");
  });
});
