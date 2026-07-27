import "dotenv/config";
import bcrypt from "bcryptjs";
import { PlanTier, PrismaClient, Role, ShopVerificationStatus, SubscriptionStatus } from "@prisma/client";
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

  await prisma.user.upsert({
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
