import "dotenv/config";
import bcrypt from "bcryptjs";
import { PlanTier, PrismaClient, Role, ShopVerificationStatus, SubscriptionStatus, SupplierOrderStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL ?? ""),
});

const identities = {
  unrestrictedAdmin: {
    email: "browser-admin@ejm.test",
    loginId: "EJM-E2E-ADMIN",
    name: "EJM Browser Administrator",
  },
  supportWorker: {
    email: "browser-support@ejm.test",
    loginId: "EJM-E2E-SUPPORT",
    name: "EJM Browser Support",
  },
  owner: {
    email: "browser-owner@ejm.test",
    loginId: "EJM-E2E-OWNER",
    name: "EJM Browser Shop Owner",
  },
  supplier: {
    email: "browser-supplier@ejm.test",
    name: "EJM Browser Supplier User",
  },
} as const;

async function main() {
  if (process.env.E2E_TESTING !== "true" || process.env.NODE_ENV === "production") {
    throw new Error("Browser acceptance seeding is allowed only with E2E_TESTING=true outside production.");
  }

  const password = process.env.E2E_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error("Set E2E_PASSWORD to a disposable test password of at least 12 characters.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const shop = await prisma.shop.upsert({
    where: { slug: "ejm-browser-test-shop" },
    update: {
      name: "EJM Browser Test Shop",
      isActive: true,
      storefrontEnabled: true,
      publicOrderingEnabled: true,
      verificationStatus: ShopVerificationStatus.VERIFIED,
      verifiedAt: new Date(),
      planTier: PlanTier.PRO,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      staffLoginId: "EJM-E2E-SHOP",
    },
    create: {
      name: "EJM Browser Test Shop",
      slug: "ejm-browser-test-shop",
      city: "Accra",
      country: "Ghana",
      currency: "GHS",
      isActive: true,
      storefrontEnabled: true,
      publicOrderingEnabled: true,
      verificationStatus: ShopVerificationStatus.VERIFIED,
      verifiedAt: new Date(),
      planTier: PlanTier.PRO,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      staffLoginId: "EJM-E2E-SHOP",
    },
  });

  await prisma.user.upsert({
    where: { email: identities.unrestrictedAdmin.email },
    update: {
      adminLoginId: identities.unrestrictedAdmin.loginId,
      name: identities.unrestrictedAdmin.name,
      passwordHash,
      role: Role.SUPER_ADMIN,
      shopId: null,
      adminPermissions: [],
      isActive: true,
      failedLoginCount: 0,
      lockUntil: null,
      sessionVersion: 0,
    },
    create: {
      adminLoginId: identities.unrestrictedAdmin.loginId,
      email: identities.unrestrictedAdmin.email,
      name: identities.unrestrictedAdmin.name,
      passwordHash,
      role: Role.SUPER_ADMIN,
      adminPermissions: [],
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: identities.supportWorker.email },
    update: {
      adminLoginId: identities.supportWorker.loginId,
      name: identities.supportWorker.name,
      passwordHash,
      role: Role.SUPER_ADMIN,
      shopId: null,
      adminPermissions: ["support"],
      isActive: true,
      failedLoginCount: 0,
      lockUntil: null,
      sessionVersion: 0,
    },
    create: {
      adminLoginId: identities.supportWorker.loginId,
      email: identities.supportWorker.email,
      name: identities.supportWorker.name,
      passwordHash,
      role: Role.SUPER_ADMIN,
      adminPermissions: ["support"],
      isActive: true,
    },
  });

  const owner = await prisma.user.upsert({
    where: { email: identities.owner.email },
    update: {
      adminLoginId: identities.owner.loginId,
      name: identities.owner.name,
      passwordHash,
      role: Role.OWNER,
      shopId: shop.id,
      adminPermissions: [],
      isActive: true,
      failedLoginCount: 0,
      lockUntil: null,
      sessionVersion: 0,
    },
    create: {
      adminLoginId: identities.owner.loginId,
      email: identities.owner.email,
      name: identities.owner.name,
      passwordHash,
      role: Role.OWNER,
      shopId: shop.id,
      adminPermissions: [],
      isActive: true,
    },
  });

  const supplierUser = await prisma.user.upsert({
    where: { email: identities.supplier.email },
    update: {
      name: identities.supplier.name,
      passwordHash,
      role: Role.SUPPLIER,
      shopId: shop.id,
      adminPermissions: [],
      isActive: true,
      failedLoginCount: 0,
      lockUntil: null,
      sessionVersion: 0,
    },
    create: {
      email: identities.supplier.email,
      name: identities.supplier.name,
      passwordHash,
      role: Role.SUPPLIER,
      shopId: shop.id,
      adminPermissions: [],
      isActive: true,
    },
  });

  const supplier = await prisma.supplier.upsert({
    where: { portalUserId: supplierUser.id },
    update: {
      shopId: shop.id,
      name: "EJM Browser Supply Partner",
      contactName: identities.supplier.name,
      email: identities.supplier.email,
      phone: "+233200000001",
      categories: "Jerseys, vinyl and sports equipment",
      paymentTerms: "Test terms",
      leadTimeDays: 5,
      rating: 5,
      isActive: true,
    },
    create: {
      shopId: shop.id,
      portalUserId: supplierUser.id,
      name: "EJM Browser Supply Partner",
      contactName: identities.supplier.name,
      email: identities.supplier.email,
      phone: "+233200000001",
      categories: "Jerseys, vinyl and sports equipment",
      paymentTerms: "Test terms",
      leadTimeDays: 5,
      rating: 5,
      isActive: true,
    },
  });

  await prisma.supplierOrder.upsert({
    where: { orderNumber: "EJM-E2E-PO-001" },
    update: {
      shopId: shop.id,
      supplierId: supplier.id,
      createdById: owner.id,
      status: SupplierOrderStatus.SENT,
      totalAmount: 250,
      notes: "Disposable browser acceptance order.",
    },
    create: {
      shopId: shop.id,
      supplierId: supplier.id,
      createdById: owner.id,
      status: SupplierOrderStatus.SENT,
      orderNumber: "EJM-E2E-PO-001",
      totalAmount: 250,
      notes: "Disposable browser acceptance order.",
      items: {
        create: {
          description: "Twenty-five test jerseys",
          quantity: 25,
          unitCost: 10,
        },
      },
    },
  });

  await prisma.rateLimitBucket.deleteMany({
    where: { key: { contains: "ejm-e2e" } },
  });

  console.log("Browser acceptance identities are ready in the disposable database.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
