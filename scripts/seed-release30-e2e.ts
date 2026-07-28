import "dotenv/config";
import bcrypt from "bcryptjs";
import {
  PlanTier,
  PrismaClient,
  Role,
  ShopVerificationStatus,
  SubscriptionStatus,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL ?? ""),
});

const identity = {
  email: "browser-release30-owner@ejm.test",
  loginId: "EJM-E2E-R30-OWNER",
  name: "EJM Release 30 Media Owner",
} as const;

async function main() {
  if (process.env.E2E_TESTING !== "true" || process.env.NODE_ENV === "production") {
    throw new Error("Release 30 browser seeding is allowed only with E2E_TESTING=true outside production.");
  }
  const password = process.env.E2E_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error("Set E2E_PASSWORD to a disposable test password of at least 12 characters.");
  }

  const shop = await prisma.shop.upsert({
    where: { slug: "ejm-release30-media-shop" },
    update: {
      name: "EJM Release 30 Media Shop",
      logoUrl: null,
      isActive: true,
      storefrontEnabled: true,
      publicOrderingEnabled: true,
      verificationStatus: ShopVerificationStatus.VERIFIED,
      verifiedAt: new Date(),
      planTier: PlanTier.PRO,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      staffLoginId: "EJM-E2E-R30-SHOP",
    },
    create: {
      name: "EJM Release 30 Media Shop",
      slug: "ejm-release30-media-shop",
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
      staffLoginId: "EJM-E2E-R30-SHOP",
    },
  });

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email: identity.email },
    update: {
      adminLoginId: identity.loginId,
      name: identity.name,
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
      adminLoginId: identity.loginId,
      email: identity.email,
      name: identity.name,
      passwordHash,
      role: Role.OWNER,
      shopId: shop.id,
      adminPermissions: [],
      isActive: true,
    },
  });

  const category = await prisma.category.upsert({
    where: { shopId_name: { shopId: shop.id, name: "Release 30 Products" } },
    update: {},
    create: { shopId: shop.id, name: "Release 30 Products" },
  });

  const products = await prisma.product.findMany({
    where: { shopId: shop.id, name: "Release 30 Compressed Product" },
    select: { id: true },
  });
  if (products.length) {
    await prisma.product.deleteMany({ where: { id: { in: products.map((product) => product.id) } } });
  }
  await prisma.mediaAsset.deleteMany({ where: { shopId: shop.id } });
  await prisma.designJob.deleteMany({ where: { shopId: shop.id } });
  await prisma.shopMachineProfile.upsert({
    where: { shopId_name: { shopId: shop.id, name: "Generic SVG cutter" } },
    update: { isActive: true, isDefault: true, outputFormat: "SVG_CUT" },
    create: {
      shopId: shop.id,
      name: "Generic SVG cutter",
      outputFormat: "SVG_CUT",
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
  await prisma.rateLimitBucket.deleteMany({
    where: { key: { contains: "ejm-e2e-r30" } },
  });

  console.log(`Release 30 media shop ready: ${shop.id}, category ${category.id}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
