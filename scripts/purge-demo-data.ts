import "dotenv/config";

import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL ?? ""),
});

const PURGE_CONFIRMATION = "PURGE-ACC-PRO-DEMO-2026";
const DEMO_SHOP_SLUG = "accra-pro-sports";
const DEMO_USER_EMAILS = [
  "super@ypms.test",
  "owner@accra.test",
  "manager@accra.test",
  "cashier@accra.test",
  "designer@accra.test",
  "accountant@accra.test",
  "supplier@accra.test",
] as const;
const DEMO_LOGIN_IDS = [
  "YPMS-ADMIN-ROOT",
  "APS-OWNER",
  "APS-MANAGER",
  "APS-CASHIER",
  "APS-DESIGNER",
  "APS-ACCOUNTANT",
  "APS-SUPPLIER",
  "APS-STAFF",
] as const;
const DEMO_BUYER_EMAIL = "buyer@demo.test";
const DEMO_BUYER_PHONE = "+233550000000";
const DEMO_PROVIDER_REFERENCES = ["DEMO-PAYSTACK-MOMO", "APS-10001"] as const;
const DEMO_VARIANT_SKUS = [
  "JER-HOME-S",
  "JER-HOME-M",
  "JER-HOME-L",
  "KIT-AWAY-M",
  "KIT-AWAY-XL",
  "BOOT-TURF-42",
  "BOOT-TURF-43",
  "BALL-FIFA-4",
  "BALL-FIFA-5",
  "SHIN-CARBON-S",
  "SHIN-CARBON-M",
  "SHIN-CARBON-L",
  "CONE-SET-20",
  "CONE-SET-50",
  "SVC-PRINT-NAME-NUMBER",
] as const;

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function isPurgeEnabled() {
  const confirmation = process.env.PURGE_DEMO_DATA?.trim();
  if (confirmation !== PURGE_CONFIRMATION) {
    console.log(`Demo purge skipped. Set PURGE_DEMO_DATA=${PURGE_CONFIRMATION} for the one-time cleanup.`);
    return false;
  }

  if (process.env.NODE_ENV !== "production" && process.env.PURGE_DEMO_ALLOW_NON_PRODUCTION !== "true") {
    throw new Error("Demo purge is restricted to production. Tests must explicitly set PURGE_DEMO_ALLOW_NON_PRODUCTION=true.");
  }

  return true;
}

async function requireRealAdmin() {
  const adminEmail = requiredEnv("ADMIN_EMAIL").toLowerCase();
  if (DEMO_USER_EMAILS.includes(adminEmail as (typeof DEMO_USER_EMAILS)[number])) {
    throw new Error("ADMIN_EMAIL is still a seeded demo identity. Refusing destructive cleanup.");
  }

  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin || admin.role !== Role.SUPER_ADMIN || admin.shopId || !admin.isActive) {
    throw new Error("An active, shop-independent production SUPER_ADMIN must exist before demo data can be purged.");
  }

  return admin;
}

async function assertNoCrossTenantReferences(
  demoShopId: string | null,
  demoUserIds: string[],
  demoBuyerId: string | null,
) {
  for (const user of await prisma.user.findMany({
    where: { id: { in: demoUserIds } },
    select: { email: true, shopId: true },
  })) {
    if (user.shopId && user.shopId !== demoShopId) {
      throw new Error(`Demo identity ${user.email} is attached to a non-demo shop. Refusing cleanup.`);
    }
  }

  if (demoUserIds.length > 0) {
    const outsideRequiredShop = demoShopId ? { not: demoShopId } : undefined;
    const outsideUserReferences = await Promise.all([
      prisma.shop.count({ where: { verifiedById: { in: demoUserIds }, ...(demoShopId ? { id: { not: demoShopId } } : {}) } }),
      prisma.order.count({ where: { processedById: { in: demoUserIds }, shopId: outsideRequiredShop } }),
      prisma.inviteToken.count({ where: { createdById: { in: demoUserIds }, shopId: outsideRequiredShop } }),
      prisma.notification.count({ where: { userId: { in: demoUserIds }, shopId: outsideRequiredShop } }),
      prisma.supplierOrder.count({ where: { createdById: { in: demoUserIds }, shopId: outsideRequiredShop } }),
      prisma.dailyClosing.count({ where: { closedById: { in: demoUserIds }, shopId: outsideRequiredShop } }),
      prisma.debtPayment.count({ where: { receivedById: { in: demoUserIds }, shopId: outsideRequiredShop } }),
      prisma.mediaAsset.count({
        where: {
          uploadedById: { in: demoUserIds },
          ...(demoShopId ? { OR: [{ shopId: null }, { shopId: { not: demoShopId } }] } : {}),
        },
      }),
    ]);

    if (outsideUserReferences.some((count) => count > 0)) {
      throw new Error(`Demo staff identities have ${outsideUserReferences.reduce((sum, count) => sum + count, 0)} references outside the demo tenant. Refusing cleanup.`);
    }
  }

  if (demoBuyerId) {
    const outsideRequiredShop = demoShopId ? { not: demoShopId } : undefined;
    const outsideBuyerReferences = await Promise.all([
      prisma.order.count({ where: { buyerId: demoBuyerId, shopId: outsideRequiredShop } }),
      prisma.productReview.count({ where: { buyerId: demoBuyerId, shopId: outsideRequiredShop } }),
      prisma.buyerCartItem.count({ where: { buyerId: demoBuyerId, shopId: outsideRequiredShop } }),
      prisma.returnRequest.count({ where: { buyerId: demoBuyerId, shopId: outsideRequiredShop } }),
    ]);

    if (outsideBuyerReferences.some((count) => count > 0)) {
      throw new Error(`The seeded demo buyer has ${outsideBuyerReferences.reduce((sum, count) => sum + count, 0)} references outside the demo tenant. Refusing cleanup.`);
    }
  }
}

async function collectInventory(demoShopId: string | null) {
  if (!demoShopId) {
    return {
      shops: 0,
      users: await prisma.user.count({ where: { email: { in: [...DEMO_USER_EMAILS] } } }),
      buyers: await prisma.buyerAccount.count({
        where: { OR: [{ email: DEMO_BUYER_EMAIL }, { phone: DEMO_BUYER_PHONE }] },
      }),
      products: 0,
      customers: 0,
      orders: 0,
      suppliers: 0,
      supplierOrders: 0,
      designJobs: 0,
      reviews: 0,
      auditLogs: 0,
    };
  }

  const [users, products, customers, orders, suppliers, supplierOrders, designJobs, reviews, auditLogs, buyers] = await Promise.all([
    prisma.user.count({ where: { OR: [{ shopId: demoShopId }, { email: { in: [...DEMO_USER_EMAILS] } }] } }),
    prisma.product.count({ where: { shopId: demoShopId } }),
    prisma.customer.count({ where: { shopId: demoShopId } }),
    prisma.order.count({ where: { shopId: demoShopId } }),
    prisma.supplier.count({ where: { shopId: demoShopId } }),
    prisma.supplierOrder.count({ where: { shopId: demoShopId } }),
    prisma.designJob.count({ where: { shopId: demoShopId } }),
    prisma.productReview.count({ where: { shopId: demoShopId } }),
    prisma.auditLog.count({ where: { shopId: demoShopId } }),
    prisma.buyerAccount.count({ where: { OR: [{ email: DEMO_BUYER_EMAIL }, { phone: DEMO_BUYER_PHONE }] } }),
  ]);

  return {
    shops: 1,
    users,
    buyers,
    products,
    customers,
    orders,
    suppliers,
    supplierOrders,
    designJobs,
    reviews,
    auditLogs,
  };
}

async function verifyClean() {
  const [shops, users, buyers, suppliers, customers, variants, payments, providerEvents] = await Promise.all([
    prisma.shop.count({ where: { slug: DEMO_SHOP_SLUG } }),
    prisma.user.count({ where: { email: { in: [...DEMO_USER_EMAILS] } } }),
    prisma.buyerAccount.count({ where: { OR: [{ email: DEMO_BUYER_EMAIL }, { phone: DEMO_BUYER_PHONE }] } }),
    prisma.supplier.count({ where: { id: "demo-supplier-elitekits" } }),
    prisma.customer.count({ where: { id: "demo-customer-akua" } }),
    prisma.productVariant.count({ where: { sku: { in: [...DEMO_VARIANT_SKUS] } } }),
    prisma.payment.count({ where: { providerReference: { in: [...DEMO_PROVIDER_REFERENCES] } } }),
    prisma.paymentProviderEvent.count({ where: { reference: { in: [...DEMO_PROVIDER_REFERENCES] } } }),
  ]);

  const remaining = { shops, users, buyers, suppliers, customers, variants, payments, providerEvents };
  if (Object.values(remaining).some((count) => count > 0)) {
    throw new Error(`Demo purge verification failed: ${JSON.stringify(remaining)}`);
  }

  return remaining;
}

async function main() {
  if (!isPurgeEnabled()) return;

  const admin = await requireRealAdmin();
  const demoShop = await prisma.shop.findUnique({
    where: { slug: DEMO_SHOP_SLUG },
    select: { id: true, name: true },
  });
  const demoUsers = await prisma.user.findMany({
    where: { email: { in: [...DEMO_USER_EMAILS] }, id: { not: admin.id } },
    select: { id: true, email: true },
  });
  const demoBuyer = await prisma.buyerAccount.findFirst({
    where: { OR: [{ email: DEMO_BUYER_EMAIL }, { phone: DEMO_BUYER_PHONE }] },
    select: { id: true },
  });

  await assertNoCrossTenantReferences(
    demoShop?.id ?? null,
    demoUsers.map((user) => user.id),
    demoBuyer?.id ?? null,
  );

  const inventory = await collectInventory(demoShop?.id ?? null);
  console.log(`Demo purge inventory: ${JSON.stringify(inventory)}`);

  const deleted = await prisma.$transaction(async (tx) => {
    const providerEvents = await tx.paymentProviderEvent.deleteMany({
      where: { reference: { in: [...DEMO_PROVIDER_REFERENCES] } },
    });

    const rateLimitKeys = [...DEMO_USER_EMAILS, ...DEMO_LOGIN_IDS, DEMO_BUYER_EMAIL, DEMO_BUYER_PHONE, DEMO_SHOP_SLUG];
    const rateLimits = await tx.rateLimitBucket.deleteMany({
      where: { OR: rateLimitKeys.map((key) => ({ key: { contains: key } })) },
    });

    const auditLogs = await tx.auditLog.deleteMany({
      where: {
        OR: [
          ...(demoShop ? [{ shopId: demoShop.id }] : []),
          ...(demoUsers.length > 0 ? [{ userId: { in: demoUsers.map((user) => user.id) } }] : []),
          { action: "seed.demo_ready" },
        ],
      },
    });

    let shops = 0;
    if (demoShop) {
      await tx.shop.delete({ where: { id: demoShop.id } });
      shops = 1;
    }

    const users = await tx.user.deleteMany({
      where: {
        AND: [
          { id: { in: demoUsers.map((user) => user.id) } },
          { id: { not: admin.id } },
        ],
      },
    });

    let buyers = 0;
    if (demoBuyer) {
      await tx.buyerAccount.delete({ where: { id: demoBuyer.id } });
      buyers = 1;
    }

    await tx.auditLog.create({
      data: {
        userId: admin.id,
        action: "production.demo_data_purged",
        entityType: "Platform",
        entityId: admin.id,
        metadata: {
          confirmation: PURGE_CONFIRMATION,
          inventory,
          deleted: {
            shops,
            users: users.count,
            buyers,
            providerEvents: providerEvents.count,
            rateLimits: rateLimits.count,
            auditLogs: auditLogs.count,
          },
        },
      },
    });

    return {
      shops,
      users: users.count,
      buyers,
      providerEvents: providerEvents.count,
      rateLimits: rateLimits.count,
      auditLogs: auditLogs.count,
    };
  }, { timeout: 30_000 });

  await verifyClean();
  console.log(`Production demo purge complete: ${JSON.stringify(deleted)}`);
  console.log("Remove PURGE_DEMO_DATA from Railway Variables after this successful deployment.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
