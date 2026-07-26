import "dotenv/config";

import bcrypt from "bcryptjs";
import { Prisma, PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL ?? ""),
});

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

const DEMO_BUYER_EMAIL = "buyer@demo.test";
const DEMO_BUYER_PHONE = "+233550000000";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function optionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function enabled(name: string) {
  return process.env[name]?.trim().toLowerCase() === "true";
}

function assertStrongPassword(password: string) {
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  }
}

async function ensureProductionAdmin() {
  const email = requiredEnv("ADMIN_EMAIL").toLowerCase();
  const adminLoginId = (optionalEnv("ADMIN_LOGIN_ID") ?? "EJM-ADMIN-ROOT").toUpperCase();
  const name = optionalEnv("ADMIN_NAME") ?? "Platform Super Admin";
  const phone = optionalEnv("ADMIN_PHONE");
  const forcePasswordReset = enabled("ADMIN_FORCE_RESET");

  if (DEMO_USER_EMAILS.includes(email as (typeof DEMO_USER_EMAILS)[number])) {
    throw new Error("ADMIN_EMAIL must be a real production address, not a seeded demo address.");
  }

  const conflictingLogin = await prisma.user.findUnique({
    where: { adminLoginId },
    select: { id: true, email: true },
  });

  if (conflictingLogin && conflictingLogin.email !== email) {
    if (!DEMO_USER_EMAILS.includes(conflictingLogin.email as (typeof DEMO_USER_EMAILS)[number])) {
      throw new Error(`ADMIN_LOGIN_ID ${adminLoginId} is already assigned to another real account.`);
    }

    await prisma.user.update({
      where: { id: conflictingLogin.id },
      data: {
        adminLoginId: null,
        isActive: false,
        sessionVersion: { increment: 1 },
        failedLoginCount: 0,
        lockUntil: null,
      },
    });
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing && (existing.role !== Role.SUPER_ADMIN || existing.shopId)) {
    throw new Error("ADMIN_EMAIL already belongs to a tenant account and cannot be promoted automatically.");
  }

  if (!existing) {
    const password = requiredEnv("ADMIN_PASSWORD");
    assertStrongPassword(password);

    const admin = await prisma.user.create({
      data: {
        adminLoginId,
        email,
        passwordHash: await bcrypt.hash(password, 12),
        name,
        phone,
        role: Role.SUPER_ADMIN,
        isActive: true,
        staffTitle: "Platform Super Admin",
        department: "Platform Command",
      },
    });

    return { admin, created: true, passwordReset: false };
  }

  const updateData: Prisma.UserUpdateInput = {
    adminLoginId,
    name,
    phone,
    role: Role.SUPER_ADMIN,
    shop: { disconnect: true },
    isActive: true,
    failedLoginCount: 0,
    lockUntil: null,
    staffTitle: "Platform Super Admin",
    department: "Platform Command",
  };

  if (forcePasswordReset) {
    const password = requiredEnv("ADMIN_PASSWORD");
    assertStrongPassword(password);
    updateData.passwordHash = await bcrypt.hash(password, 12);
    updateData.sessionVersion = { increment: 1 };
  }

  const admin = await prisma.user.update({
    where: { id: existing.id },
    data: updateData,
  });

  return { admin, created: false, passwordReset: forcePasswordReset };
}

async function retireDemoAccess(adminId: string) {
  const demoShop = await prisma.shop.findUnique({
    where: { slug: DEMO_SHOP_SLUG },
    select: { id: true },
  });

  return prisma.$transaction(async (tx) => {
    const demoUserConditions: Prisma.UserWhereInput[] = [
      { email: { in: [...DEMO_USER_EMAILS] } },
    ];
    if (demoShop) demoUserConditions.push({ shopId: demoShop.id });

    const users = await tx.user.updateMany({
      where: {
        id: { not: adminId },
        isActive: true,
        OR: demoUserConditions,
      },
      data: {
        isActive: false,
        sessionVersion: { increment: 1 },
        failedLoginCount: 0,
        lockUntil: null,
      },
    });

    const buyer = await tx.buyerAccount.updateMany({
      where: {
        isActive: true,
        OR: [
          { email: DEMO_BUYER_EMAIL },
          { phone: DEMO_BUYER_PHONE },
        ],
      },
      data: { isActive: false },
    });

    const supplierConditions: Prisma.SupplierWhereInput[] = [
      { email: "supplier@accra.test" },
    ];
    if (demoShop) supplierConditions.push({ shopId: demoShop.id });

    const suppliers = await tx.supplier.updateMany({
      where: {
        isActive: true,
        OR: supplierConditions,
      },
      data: { isActive: false },
    });

    const shops = await tx.shop.updateMany({
      where: {
        slug: DEMO_SHOP_SLUG,
        OR: [
          { isActive: true },
          { storefrontEnabled: true },
          { publicOrderingEnabled: true },
        ],
      },
      data: {
        isActive: false,
        storefrontEnabled: false,
        publicOrderingEnabled: false,
        verificationStatus: "SUSPENDED",
      },
    });

    return {
      users: users.count,
      buyers: buyer.count,
      suppliers: suppliers.count,
      shops: shops.count,
    };
  });
}

async function main() {
  const { admin, created, passwordReset } = await ensureProductionAdmin();
  const retired = await retireDemoAccess(admin.id);

  if (created || passwordReset || Object.values(retired).some((count) => count > 0)) {
    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: "production.account_activation",
        entityType: "User",
        entityId: admin.id,
        metadata: {
          adminEmail: admin.email,
          adminLoginId: admin.adminLoginId,
          created,
          passwordReset,
          retired,
        },
      },
    });
  }

  console.log("Production activation complete.");
  console.log(`Admin: ${admin.adminLoginId ?? admin.email}`);
  console.log(`Created: ${created ? "yes" : "no"}`);
  console.log(`Password reset: ${passwordReset ? "yes" : "no"}`);
  console.log(`Retired demo users: ${retired.users}`);
  console.log(`Retired demo buyers: ${retired.buyers}`);
  console.log(`Retired demo suppliers: ${retired.suppliers}`);
  console.log(`Suspended demo shops: ${retired.shops}`);
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
