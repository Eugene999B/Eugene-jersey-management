import "dotenv/config";
import { createCipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import {
  AccountKind,
  PlanTier,
  PrismaClient,
  Role,
  ShopVerificationStatus,
  SubscriptionStatus,
  SupplierOrderStatus,
} from "@prisma/client";
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
  designer: {
    email: "browser-designer@ejm.test",
    loginId: "EJM-E2E-DESIGNER",
    name: "EJM Browser Designer",
  },
  twoFactorOwner: {
    email: "browser-2fa-owner@ejm.test",
    loginId: "EJM-E2E-2FA-OWNER",
    name: "EJM Browser Protected Owner",
    secret: "JBSWY3DPEHPK3PXP",
  },
  twoFactorBuyer: {
    email: "browser-2fa-buyer@ejm.test",
    phone: "+233200000099",
    name: "EJM Browser Protected Buyer",
    secret: "KRSXG5DSNFXGOIDB",
  },
  supplier: {
    email: "browser-supplier@ejm.test",
    name: "EJM Browser Supplier User",
  },
} as const;

function twoFactorKey() {
  const configured = process.env.TWO_FACTOR_ENCRYPTION_KEY;
  if (!configured || configured.length < 32) {
    throw new Error("Set TWO_FACTOR_ENCRYPTION_KEY to a disposable value of at least 32 characters.");
  }
  return createHash("sha256").update(configured, "utf8").digest();
}

function encryptTwoFactorSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", twoFactorKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function hashRecoveryCode(value: string) {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return createHmac("sha256", twoFactorKey()).update(`ejm-recovery:${normalized}`, "utf8").digest("hex");
}

async function setProtectedAccount(accountKind: AccountKind, accountId: string, secret: string, recoveryCode: string) {
  await prisma.accountTwoFactor.upsert({
    where: { accountKind_accountId: { accountKind, accountId } },
    update: {
      enabled: true,
      encryptedSecret: encryptTwoFactorSecret(secret),
      recoveryCodeHashes: [hashRecoveryCode(recoveryCode)],
      pendingEncryptedSecret: null,
      pendingRecoveryCodeHashes: [],
      pendingExpiresAt: null,
      enabledAt: new Date(),
    },
    create: {
      accountKind,
      accountId,
      enabled: true,
      encryptedSecret: encryptTwoFactorSecret(secret),
      recoveryCodeHashes: [hashRecoveryCode(recoveryCode)],
      enabledAt: new Date(),
    },
  });
}

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

  await prisma.shopMachineProfile.deleteMany({
    where: { shopId: shop.id, name: "E2E Browser Cutter" },
  });
  await prisma.shopMachineProfile.updateMany({
    where: { shopId: shop.id, isDefault: true },
    data: { isDefault: false },
  });
  await prisma.shopMachineProfile.upsert({
    where: { shopId_name: { shopId: shop.id, name: "Generic SVG cutter" } },
    update: {
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

  await prisma.user.upsert({
    where: { email: identities.designer.email },
    update: {
      adminLoginId: identities.designer.loginId,
      name: identities.designer.name,
      passwordHash,
      role: Role.DESIGNER,
      shopId: shop.id,
      adminPermissions: [],
      isActive: true,
      failedLoginCount: 0,
      lockUntil: null,
      sessionVersion: 0,
    },
    create: {
      adminLoginId: identities.designer.loginId,
      email: identities.designer.email,
      name: identities.designer.name,
      passwordHash,
      role: Role.DESIGNER,
      shopId: shop.id,
      adminPermissions: [],
      isActive: true,
    },
  });

  const twoFactorOwner = await prisma.user.upsert({
    where: { email: identities.twoFactorOwner.email },
    update: {
      adminLoginId: identities.twoFactorOwner.loginId,
      name: identities.twoFactorOwner.name,
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
      adminLoginId: identities.twoFactorOwner.loginId,
      email: identities.twoFactorOwner.email,
      name: identities.twoFactorOwner.name,
      passwordHash,
      role: Role.OWNER,
      shopId: shop.id,
      adminPermissions: [],
      isActive: true,
    },
  });
  await setProtectedAccount(AccountKind.USER, twoFactorOwner.id, identities.twoFactorOwner.secret, "EJM2-FA01");

  const twoFactorBuyer = await prisma.buyerAccount.upsert({
    where: { phone: identities.twoFactorBuyer.phone },
    update: {
      email: identities.twoFactorBuyer.email,
      name: identities.twoFactorBuyer.name,
      passwordHash,
      phoneVerifiedAt: new Date(),
      isActive: true,
    },
    create: {
      email: identities.twoFactorBuyer.email,
      phone: identities.twoFactorBuyer.phone,
      name: identities.twoFactorBuyer.name,
      passwordHash,
      phoneVerifiedAt: new Date(),
      isActive: true,
    },
  });
  await setProtectedAccount(AccountKind.BUYER, twoFactorBuyer.id, identities.twoFactorBuyer.secret, "BUY2-FA01");

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
