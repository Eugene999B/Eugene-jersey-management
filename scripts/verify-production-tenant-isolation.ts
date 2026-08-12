import "dotenv/config";
import { ProductionInventoryKind, ProductionInventoryUnit } from "@prisma/client";
import { platformDb } from "../src/lib/platform-db";
import { createTenantDb, TenantDatabaseAccessError, TenantScopeMismatchError } from "../src/lib/tenant-db";

const SHOP_A_SLUG = "e2e-production-isolation-a";
const SHOP_B_SLUG = "e2e-production-isolation-b";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function expectRejects(errorType: typeof TenantDatabaseAccessError, operation: () => Promise<unknown>, message: string) {
  try {
    await operation();
  } catch (error) {
    if (error instanceof errorType) return;
    throw error;
  }
  throw new Error(message);
}

async function cleanup() {
  const shops = await platformDb.shop.findMany({
    where: { slug: { in: [SHOP_A_SLUG, SHOP_B_SLUG] } },
    select: { id: true },
  });
  const shopIds = shops.map((shop) => shop.id);
  if (shopIds.length) {
    await platformDb.productionInventoryMovement.deleteMany({ where: { shopId: { in: shopIds } } });
    await platformDb.productionInventoryItem.deleteMany({ where: { shopId: { in: shopIds } } });
    await platformDb.shop.deleteMany({ where: { id: { in: shopIds } } });
  }
}

async function createShop(slug: string, name: string) {
  return platformDb.shop.create({
    data: {
      slug,
      name,
      legalBusinessName: name,
      verificationStatus: "VERIFIED",
      storefrontEnabled: true,
      publicOrderingEnabled: true,
    },
  });
}

async function main() {
  if (process.env.TENANT_ISOLATION_TESTING !== "true" || process.env.NODE_ENV === "production") {
    throw new Error("Production tenant isolation verification is restricted to a disposable non-production database.");
  }

  await cleanup();
  try {
    const [shopA, shopB] = await Promise.all([
      createShop(SHOP_A_SLUG, "Production Isolation A"),
      createShop(SHOP_B_SLUG, "Production Isolation B"),
    ]);
    const [itemA, itemB] = await Promise.all([
      platformDb.productionInventoryItem.create({
        data: {
          shopId: shopA.id,
          inventoryKey: "GARMENT|PIECE|name:a|colour:black|size:m|variant:-",
          kind: ProductionInventoryKind.GARMENT,
          name: "Tenant A black tee",
          colour: "Black",
          size: "M",
          unit: ProductionInventoryUnit.PIECE,
          quantity: 5,
          unitCost: 20,
        },
      }),
      platformDb.productionInventoryItem.create({
        data: {
          shopId: shopB.id,
          inventoryKey: "GARMENT|PIECE|name:b|colour:white|size:l|variant:-",
          kind: ProductionInventoryKind.GARMENT,
          name: "Tenant B white tee",
          colour: "White",
          size: "L",
          unit: ProductionInventoryUnit.PIECE,
          quantity: 7,
          unitCost: 22,
        },
      }),
    ]);

    const tenantA = createTenantDb(shopA.id);
    const visible = await tenantA.productionInventoryItem.findMany({ orderBy: { name: "asc" } });
    assert(visible.length === 1 && visible[0].id === itemA.id, "Tenant A production stock read leaked another shop.");

    const foreign = await tenantA.productionInventoryItem.findUnique({ where: { id: itemB.id } });
    assert(foreign === null, "Tenant A found Tenant B production stock by unique id.");

    const foreignUpdate = await tenantA.productionInventoryItem.updateMany({
      where: { id: itemB.id },
      data: { quantity: 999 },
    });
    assert(foreignUpdate.count === 0, "Tenant A updated Tenant B production stock.");

    await expectRejects(
      TenantScopeMismatchError,
      () => tenantA.productionInventoryItem.create({
        data: {
          shopId: shopB.id,
          inventoryKey: "GARMENT|PIECE|name:cross|colour:red|size:s|variant:-",
          kind: ProductionInventoryKind.GARMENT,
          name: "Cross tenant stock",
          unit: ProductionInventoryUnit.PIECE,
        },
      }),
      "Tenant A created production stock under Tenant B.",
    );

    const transactionVisible = await tenantA.$transaction((transaction) => transaction.productionInventoryItem.findMany());
    assert(transactionVisible.length === 1 && transactionVisible[0].id === itemA.id, "Interactive transaction leaked Tenant B production stock.");

    await expectRejects(
      TenantDatabaseAccessError,
      () => tenantA.$transaction((transaction) => transaction.$queryRaw`SELECT 1`),
      "Interactive tenant transaction executed raw SQL.",
    );

    const unchangedB = await platformDb.productionInventoryItem.findUnique({ where: { id: itemB.id } });
    assert(Number(unchangedB?.quantity) === 7, "Tenant B production stock changed during Tenant A attack checks.");

    console.log("Production tenant isolation verification passed.");
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
