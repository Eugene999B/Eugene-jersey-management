import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL ?? ""),
});

const identities = [
  { role: Role.MANAGER, email: "browser-manager@ejm.test", loginId: "EJM-E2E-MANAGER", name: "EJM Browser Manager" },
  { role: Role.CASHIER, email: "browser-cashier@ejm.test", loginId: "EJM-E2E-CASHIER", name: "EJM Browser Cashier" },
  { role: Role.INVENTORY_CLERK, email: "browser-inventory@ejm.test", loginId: "EJM-E2E-INVENTORY", name: "EJM Browser Inventory Clerk" },
  { role: Role.ACCOUNTANT, email: "browser-accountant@ejm.test", loginId: "EJM-E2E-ACCOUNTANT", name: "EJM Browser Accountant" },
  { role: Role.VIEWER, email: "browser-viewer@ejm.test", loginId: "EJM-E2E-VIEWER", name: "EJM Browser Viewer" },
] as const;

async function main() {
  if (process.env.E2E_TESTING !== "true" || process.env.NODE_ENV === "production") {
    throw new Error("Phase 21 browser acceptance seeding is allowed only with E2E_TESTING=true outside production.");
  }

  const password = process.env.E2E_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error("Set E2E_PASSWORD to a disposable test password of at least 12 characters.");
  }

  const shop = await prisma.shop.findUnique({ where: { slug: "ejm-browser-test-shop" }, select: { id: true } });
  if (!shop) throw new Error("Run the core browser acceptance seed before Phase 21 role seeding.");

  const passwordHash = await bcrypt.hash(password, 12);
  for (const identity of identities) {
    await prisma.user.upsert({
      where: { email: identity.email },
      update: {
        adminLoginId: identity.loginId,
        name: identity.name,
        passwordHash,
        role: identity.role,
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
        role: identity.role,
        shopId: shop.id,
        adminPermissions: [],
        isActive: true,
      },
    });
  }

  console.log("Phase 21 manager, cashier, inventory, accountant and viewer browser identities are ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
