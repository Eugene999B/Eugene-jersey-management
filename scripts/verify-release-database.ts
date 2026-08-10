import "dotenv/config";

import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolveDeploymentTier } from "./deployment-predeploy";

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL ?? "") });

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
const E2E_SHOP_SLUG = "ejm-browser-test-shop";

function asNumber(value: bigint | number | string | null | undefined) {
  return Number(value ?? 0);
}

async function migrationState() {
  const rows = await prisma.$queryRaw<Array<{ total: bigint; unfinished: bigint; rolledBack: bigint }>>`
    SELECT
      COUNT(*)::BIGINT AS "total",
      COUNT(*) FILTER (WHERE "finished_at" IS NULL AND "rolled_back_at" IS NULL)::BIGINT AS "unfinished",
      COUNT(*) FILTER (WHERE "rolled_back_at" IS NOT NULL)::BIGINT AS "rolledBack"
    FROM "_prisma_migrations"
  `;
  const row = rows[0];
  return {
    total: asNumber(row?.total),
    unfinished: asNumber(row?.unfinished),
    rolledBack: asNumber(row?.rolledBack),
  };
}

async function productionSafetyState() {
  const [activePlatformAdmins, activeDemoUsers, activeDemoBuyers, exposedDemoShop, e2eShops] = await Promise.all([
    prisma.user.count({ where: { role: Role.SUPER_ADMIN, shopId: null, isActive: true } }),
    prisma.user.count({ where: { email: { in: [...DEMO_USER_EMAILS] }, isActive: true } }),
    prisma.buyerAccount.count({
      where: {
        isActive: true,
        OR: [{ email: DEMO_BUYER_EMAIL }, { phone: DEMO_BUYER_PHONE }],
      },
    }),
    prisma.shop.count({
      where: {
        slug: DEMO_SHOP_SLUG,
        OR: [{ isActive: true }, { storefrontEnabled: true }, { publicOrderingEnabled: true }],
      },
    }),
    prisma.shop.count({ where: { slug: E2E_SHOP_SLUG } }),
  ]);
  return { activePlatformAdmins, activeDemoUsers, activeDemoBuyers, exposedDemoShop, e2eShops };
}

async function main() {
  const tier = resolveDeploymentTier();
  await prisma.$queryRaw`SELECT 1`;
  const migrations = await migrationState();
  if (migrations.total < 1) throw new Error("Release database has no Prisma migration history.");
  if (migrations.unfinished > 0) throw new Error(`Release database has ${migrations.unfinished} unfinished Prisma migration(s).`);

  const summary: Record<string, unknown> = {
    tier,
    railwayEnvironment: process.env.RAILWAY_ENVIRONMENT_NAME ?? null,
    migrations,
  };

  if (tier === "production") {
    const safety = await productionSafetyState();
    summary.productionSafety = safety;
    if (safety.activePlatformAdmins < 1) throw new Error("Production release has no active shop-independent SUPER_ADMIN.");
    if (safety.activeDemoUsers > 0 || safety.activeDemoBuyers > 0 || safety.exposedDemoShop > 0) {
      throw new Error(`Production demo access remains exposed: ${JSON.stringify(safety)}.`);
    }
    if (safety.e2eShops > 0) throw new Error("Browser acceptance tenant markers were found in production. Refusing release verification.");
  }

  console.log(`Release database verification passed: ${JSON.stringify(summary)}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
