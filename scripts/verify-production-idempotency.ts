import "dotenv/config";
import {
  Prisma,
  ProductionInventoryKind,
  ProductionInventoryMovementType,
  ProductionInventoryUnit,
  SupplierAccountEntryType,
} from "@prisma/client";
import { platformDb } from "../src/lib/platform-db";
import { applyProductionInventoryMovement } from "../src/lib/production-inventory";
import { createTenantDb } from "../src/lib/tenant-db";

const SHOP_SLUG = "e2e-production-idempotency";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function inventoryTransaction(tx: unknown) {
  return tx as Prisma.TransactionClient;
}

function isUniqueConflict(reason: unknown) {
  return reason instanceof Prisma.PrismaClientKnownRequestError && reason.code === "P2002";
}

async function cleanup() {
  const shop = await platformDb.shop.findUnique({ where: { slug: SHOP_SLUG }, select: { id: true } });
  if (!shop) return;
  await platformDb.supplierAccountEntry.deleteMany({ where: { shopId: shop.id } });
  await platformDb.supplierStockReturn.deleteMany({ where: { shopId: shop.id } });
  await platformDb.productionInventoryMovement.deleteMany({ where: { shopId: shop.id } });
  await platformDb.productionInventoryItem.deleteMany({ where: { shopId: shop.id } });
  await platformDb.supplier.deleteMany({ where: { shopId: shop.id } });
  await platformDb.shop.delete({ where: { id: shop.id } });
}

async function main() {
  if (process.env.TENANT_ISOLATION_TESTING !== "true" || process.env.NODE_ENV === "production") {
    throw new Error("Production idempotency verification is restricted to a disposable non-production database.");
  }

  await cleanup();
  try {
    const shop = await platformDb.shop.create({
      data: {
        slug: SHOP_SLUG,
        name: "Production Idempotency",
        legalBusinessName: "Production Idempotency",
        verificationStatus: "VERIFIED",
        storefrontEnabled: true,
        publicOrderingEnabled: true,
      },
    });
    const supplier = await platformDb.supplier.create({ data: { shopId: shop.id, name: "Idempotency Supplier" } });
    const item = await platformDb.productionInventoryItem.create({
      data: {
        shopId: shop.id,
        inventoryKey: "GARMENT|PIECE|name:idempotency|colour:black|size:m|variant:-",
        kind: ProductionInventoryKind.GARMENT,
        name: "Idempotency black tee",
        colour: "Black",
        size: "M",
        unit: ProductionInventoryUnit.PIECE,
        quantity: 10,
        unitCost: 20,
      },
    });
    const tenant = createTenantDb(shop.id);

    const manualKey = "phase22b:manual:one";
    const manual = await Promise.all([
      tenant.$transaction((tx) => applyProductionInventoryMovement(inventoryTransaction(tx), {
        shopId: shop.id,
        inventoryItemId: item.id,
        type: ProductionInventoryMovementType.ADJUSTMENT_OUT,
        quantity: 1,
        note: "Concurrent manual adjustment",
        idempotencyKey: manualKey,
        createdById: "phase22b-verifier",
      })),
      tenant.$transaction((tx) => applyProductionInventoryMovement(inventoryTransaction(tx), {
        shopId: shop.id,
        inventoryItemId: item.id,
        type: ProductionInventoryMovementType.ADJUSTMENT_OUT,
        quantity: 1,
        note: "Concurrent manual adjustment",
        idempotencyKey: manualKey,
        createdById: "phase22b-verifier",
      })),
    ]);
    assert(manual.filter((result) => result.created).length === 1, "Concurrent manual adjustment reported more or fewer than one creation.");
    assert(await platformDb.productionInventoryMovement.count({ where: { shopId: shop.id, idempotencyKey: manualKey } }) === 1, "Concurrent manual adjustment created duplicate movements.");
    const afterManual = await platformDb.productionInventoryItem.findUnique({ where: { id: item.id } });
    assert(Number(afterManual?.quantity) === 9, "Concurrent manual adjustment changed stock more than once.");

    const paymentKey = "phase22b:payment:one";
    const paymentAttempts = await Promise.allSettled([
      tenant.supplierAccountEntry.create({ data: { shopId: shop.id, supplierId: supplier.id, type: SupplierAccountEntryType.PAYMENT, amount: -25, idempotencyKey: paymentKey, createdById: "phase22b-verifier" } }),
      tenant.supplierAccountEntry.create({ data: { shopId: shop.id, supplierId: supplier.id, type: SupplierAccountEntryType.PAYMENT, amount: -25, idempotencyKey: paymentKey, createdById: "phase22b-verifier" } }),
    ]);
    const paymentFailures = paymentAttempts.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    assert(paymentAttempts.filter((result) => result.status === "fulfilled").length === 1, "Supplier payment unique key did not choose exactly one winner.");
    assert(paymentFailures.length === 1 && isUniqueConflict(paymentFailures[0].reason), "Supplier payment duplicate did not fail with the expected unique-key conflict.");
    assert(await platformDb.supplierAccountEntry.count({ where: { shopId: shop.id, idempotencyKey: paymentKey } }) === 1, "Supplier payment ledger contains a duplicate row.");

    const returnKey = "phase22b:return:one";
    const returnAttempt = () => tenant.$transaction(async (tx) => {
      const existing = await tx.supplierStockReturn.findFirst({ where: { shopId: shop.id, idempotencyKey: returnKey } });
      if (existing) return { id: existing.id, created: false };
      const row = await tx.supplierStockReturn.create({
        data: {
          shopId: shop.id,
          supplierId: supplier.id,
          productionInventoryItemId: item.id,
          quantity: 2,
          unitCost: 20,
          reason: "Concurrent supplier return",
          idempotencyKey: returnKey,
          createdById: "phase22b-verifier",
        },
      });
      await applyProductionInventoryMovement(inventoryTransaction(tx), {
        shopId: shop.id,
        inventoryItemId: item.id,
        type: ProductionInventoryMovementType.SUPPLIER_RETURN,
        quantity: 2,
        unitCostSnapshot: 20,
        referenceType: "SUPPLIER_RETURN",
        referenceId: row.id,
        note: "Concurrent supplier return",
        idempotencyKey: `${returnKey}:stock`,
        createdById: "phase22b-verifier",
      });
      await tx.supplierAccountEntry.create({
        data: {
          shopId: shop.id,
          supplierId: supplier.id,
          type: SupplierAccountEntryType.RETURN_CREDIT,
          amount: -40,
          note: "Concurrent supplier return",
          idempotencyKey: `${returnKey}:credit`,
          createdById: "phase22b-verifier",
        },
      });
      return { id: row.id, created: true };
    });
    const returnAttempts = await Promise.allSettled([returnAttempt(), returnAttempt()]);
    const returnWinners = returnAttempts.filter((result) => result.status === "fulfilled" && result.value.created);
    const returnFailures = returnAttempts.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    assert(returnWinners.length === 1, "Supplier return did not create exactly one business event.");
    assert(returnFailures.every((result) => isUniqueConflict(result.reason)), "Supplier return duplicate failed for an unexpected reason.");
    assert(await platformDb.supplierStockReturn.count({ where: { shopId: shop.id, idempotencyKey: returnKey } }) === 1, "Supplier return ledger contains duplicate rows.");
    assert(await platformDb.productionInventoryMovement.count({ where: { shopId: shop.id, idempotencyKey: `${returnKey}:stock` } }) === 1, "Supplier return changed stock more than once.");
    assert(await platformDb.supplierAccountEntry.count({ where: { shopId: shop.id, idempotencyKey: `${returnKey}:credit` } }) === 1, "Supplier return credited the supplier more than once.");
    const afterReturn = await platformDb.productionInventoryItem.findUnique({ where: { id: item.id } });
    assert(Number(afterReturn?.quantity) === 7, "Supplier return changed production stock by the wrong amount.");

    console.log("Production accounting idempotency verification passed.");
  } finally {
    await cleanup();
    await platformDb.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await cleanup().catch(() => undefined);
  await platformDb.$disconnect().catch(() => undefined);
  process.exit(1);
});
