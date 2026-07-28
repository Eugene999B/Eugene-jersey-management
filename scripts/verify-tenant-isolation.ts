import "dotenv/config";
import { Prisma } from "@prisma/client";
import { platformDb } from "../src/lib/platform-db";
import { createTenantDb, TenantDatabaseAccessError, TenantScopeMismatchError } from "../src/lib/tenant-db";

const SHOP_A_SLUG = "e2e-tenant-isolation-a";
const SHOP_B_SLUG = "e2e-tenant-isolation-b";

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

async function deleteFixtures() {
  await platformDb.shop.deleteMany({ where: { slug: { in: [SHOP_A_SLUG, SHOP_B_SLUG] } } });
}

async function createFixture(slug: string, name: string) {
  const shop = await platformDb.shop.create({
    data: {
      slug,
      name,
      legalBusinessName: name,
      verificationStatus: "VERIFIED",
      storefrontEnabled: true,
      publicOrderingEnabled: true,
    },
  });
  const machineProfile = await platformDb.shopMachineProfile.create({
    data: {
      shopId: shop.id,
      name: `${name} cutter`,
      outputFormat: "HPGL",
      bedWidthMm: 305,
      bedHeightMm: 508,
      unitsPerMm: 40,
      baudRate: 9600,
      origin: "BOTTOM_LEFT",
      mirrorDefault: true,
      isDefault: true,
      isActive: true,
    },
  });
  const category = await platformDb.category.create({ data: { shopId: shop.id, name: "Isolation products" } });
  const product = await platformDb.product.create({
    data: {
      shopId: shop.id,
      categoryId: category.id,
      name: `${name} jersey`,
      basePrice: new Prisma.Decimal(100),
      variants: { create: { sku: `ISO-${slug.toUpperCase()}`, stockQty: 5 } },
    },
    include: { variants: true },
  });
  const customer = await platformDb.customer.create({ data: { shopId: shop.id, name: `${name} customer` } });
  const order = await platformDb.order.create({
    data: {
      shopId: shop.id,
      customerId: customer.id,
      status: "COMPLETED",
      channel: "POS",
      totalAmount: new Prisma.Decimal(100),
      receiptNumber: `ISO-${slug}`,
      publicAccessToken: `access-${slug}`,
      items: {
        create: {
          productVariantId: product.variants[0].id,
          quantity: 1,
          unitPrice: new Prisma.Decimal(100),
        },
      },
      payments: {
        create: {
          method: "CASH",
          amount: new Prisma.Decimal(100),
          status: "SUCCESS",
          providerReference: `payment-${slug}`,
        },
      },
    },
  });
  return { shop, machineProfile, product, variant: product.variants[0], customer, order };
}

async function main() {
  if (process.env.TENANT_ISOLATION_TESTING !== "true" || process.env.NODE_ENV === "production") {
    throw new Error("Tenant isolation verification is restricted to a disposable non-production database.");
  }

  await deleteFixtures();
  try {
    const tenantAData = await createFixture(SHOP_A_SLUG, "Isolation Shop A");
    const tenantBData = await createFixture(SHOP_B_SLUG, "Isolation Shop B");
    const tenantA = createTenantDb(tenantAData.shop.id);

    const visibleCustomers = await tenantA.customer.findMany({ orderBy: { name: "asc" } });
    assert(visibleCustomers.length === 1 && visibleCustomers[0].id === tenantAData.customer.id, "Tenant A read leaked another shop customer.");

    const foreignCustomer = await tenantA.customer.findUnique({ where: { id: tenantBData.customer.id } });
    assert(foreignCustomer === null, "Tenant A found Tenant B customer by unique id.");

    const foreignUpdate = await tenantA.customer.updateMany({
      where: { id: tenantBData.customer.id },
      data: { name: "Cross-tenant update" },
    });
    assert(foreignUpdate.count === 0, "Tenant A updated Tenant B customer.");

    const foreignDelete = await tenantA.customer.deleteMany({ where: { id: tenantBData.customer.id } });
    assert(foreignDelete.count === 0, "Tenant A deleted Tenant B customer.");

    await expectRejects(
      TenantScopeMismatchError,
      () => tenantA.customer.create({ data: { shopId: tenantBData.shop.id, name: "Cross-tenant create" } }),
      "Tenant A created a customer under Tenant B.",
    );

    const foreignVariant = await tenantA.productVariant.findUnique({ where: { id: tenantBData.variant.id } });
    assert(foreignVariant === null, "Tenant A read Tenant B child record through ProductVariant.");

    const payments = await tenantA.payment.findMany({ orderBy: { createdAt: "asc" } });
    assert(payments.length === 1 && payments[0].providerReference === `payment-${SHOP_A_SLUG}`, "Child payment scope crossed tenant ownership.");

    const transactionResult = await tenantA.$transaction(async (transaction) => transaction.customer.updateMany({
      where: { id: tenantBData.customer.id },
      data: { notes: "Transaction escape" },
    }));
    assert(transactionResult.count === 0, "Interactive transaction bypassed tenant scope.");

    const ownProfiles = await tenantA.shopMachineProfile.findMany({ orderBy: { name: "asc" } });
    assert(ownProfiles.length === 1 && ownProfiles[0].id === tenantAData.machineProfile.id, "Tenant A machine profile read leaked another shop.");
    const foreignProfile = await tenantA.shopMachineProfile.findUnique({ where: { id: tenantBData.machineProfile.id } });
    assert(foreignProfile === null, "Tenant A found Tenant B machine profile by unique id.");
    const foreignProfileUpdate = await tenantA.$transaction(async (transaction) => transaction.shopMachineProfile.updateMany({
      where: { id: tenantBData.machineProfile.id },
      data: { name: "Cross-tenant cutter" },
    }));
    assert(foreignProfileUpdate.count === 0, "Interactive transaction updated Tenant B machine profile.");
    await expectRejects(
      TenantScopeMismatchError,
      () => tenantA.shopMachineProfile.create({
        data: {
          shopId: tenantBData.shop.id,
          name: "Cross-tenant machine",
          outputFormat: "SVG_CUT",
        },
      }),
      "Tenant A created a machine profile under Tenant B.",
    );

    await expectRejects(
      TenantDatabaseAccessError,
      () => tenantA.$transaction(async (transaction) => transaction.accountTwoFactor.findMany()),
      "Interactive transaction accessed platform-global two-factor records.",
    );

    await expectRejects(
      TenantDatabaseAccessError,
      () => tenantA.platformGovernanceSettings.findMany(),
      "Tenant client accessed platform governance settings.",
    );

    await expectRejects(
      TenantDatabaseAccessError,
      () => tenantA.$transaction(async (transaction) => transaction.platformGovernanceSettings.findMany()),
      "Interactive transaction accessed platform governance settings.",
    );

    await expectRejects(
      TenantDatabaseAccessError,
      () => tenantA.subscriptionPlan.findMany(),
      "Tenant client accessed the platform subscription plan catalogue.",
    );

    await expectRejects(
      TenantDatabaseAccessError,
      () => tenantA.subscriptionPlanVersion.findMany(),
      "Tenant client accessed immutable subscription plan versions.",
    );

    await expectRejects(
      TenantDatabaseAccessError,
      () => tenantA.subscriptionPlanChangeRequest.findMany(),
      "Tenant client accessed commercial approval requests.",
    );

    await expectRejects(
      TenantDatabaseAccessError,
      () => tenantA.$transaction(async (transaction) => transaction.shopSubscriptionContract.findMany()),
      "Interactive tenant transaction accessed shop subscription contracts.",
    );

    await expectRejects(
      TenantDatabaseAccessError,
      () => tenantA.designJobVersion.findMany(),
      "Tenant client accessed design versions outside the dedicated shop-filtered API.",
    );

    await expectRejects(
      TenantDatabaseAccessError,
      () => tenantA.$transaction(async (transaction) => transaction.designJobVersion.findMany()),
      "Interactive transaction accessed design versions outside the dedicated shop-filtered API.",
    );

    const ownOrder = await tenantA.order.findUnique({ where: { id: tenantAData.order.id } });
    const foreignOrder = await tenantA.order.findUnique({ where: { id: tenantBData.order.id } });
    assert(ownOrder?.id === tenantAData.order.id && foreignOrder === null, "Order unique lookup crossed tenant scope.");

    await expectRejects(
      TenantScopeMismatchError,
      () => tenantA.shop.findUnique({ where: { id: tenantBData.shop.id } }),
      "Tenant A accessed Tenant B shop record.",
    );

    await expectRejects(
      TenantDatabaseAccessError,
      () => tenantA.buyerAccount.findMany(),
      "Tenant client accessed a platform-global model.",
    );

    await expectRejects(
      TenantDatabaseAccessError,
      () => Promise.resolve(tenantA.$queryRaw`SELECT 1`),
      "Tenant client executed raw SQL.",
    );

    const tenantBCustomerAfter = await platformDb.customer.findUniqueOrThrow({ where: { id: tenantBData.customer.id } });
    assert(tenantBCustomerAfter.name === "Isolation Shop B customer" && tenantBCustomerAfter.notes === null, "Tenant B data changed during negative tests.");

    console.log("Tenant isolation verification passed for direct models, machine profiles, child relations, transactions, design-version denial, governance denial, subscription-catalogue denial, two-factor global-model denial, and raw SQL denial.");
  } finally {
    await deleteFixtures();
    await platformDb.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await deleteFixtures().catch(() => undefined);
  await platformDb.$disconnect().catch(() => undefined);
  process.exit(1);
});
