import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL ?? ""),
});

const identities = {
  administrator: {
    email: "browser-release25-admin@ejm.test",
    loginId: "EJM-E2E-R25-ADMIN",
    name: "EJM Release 25 Administrator",
  },
  owner: {
    email: "browser-release25-owner@ejm.test",
    loginId: "EJM-E2E-R25-OWNER",
    name: "EJM Release 25 Shop Owner",
  },
} as const;

async function main() {
  if (process.env.E2E_TESTING !== "true" || process.env.NODE_ENV === "production") {
    throw new Error("Release 25 browser seeding is allowed only with E2E_TESTING=true outside production.");
  }

  const password = process.env.E2E_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error("Set E2E_PASSWORD to a disposable test password of at least 12 characters.");
  }

  const shop = await prisma.shop.findUnique({ where: { slug: "ejm-browser-test-shop" }, select: { id: true } });
  if (!shop) throw new Error("Run the main E2E seed before the Release 25 seed.");

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email: identities.administrator.email },
    update: {
      adminLoginId: identities.administrator.loginId,
      name: identities.administrator.name,
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
      adminLoginId: identities.administrator.loginId,
      email: identities.administrator.email,
      name: identities.administrator.name,
      passwordHash,
      role: Role.SUPER_ADMIN,
      adminPermissions: [],
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

  console.log("Release 25 browser acceptance identities are ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
