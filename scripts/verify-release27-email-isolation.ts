import "dotenv/config";
import assert from "node:assert/strict";
import { platformDb } from "@/lib/platform-db";
import { createTenantDb, TenantDatabaseAccessError } from "@/lib/tenant-db";

async function expectRejects(action: () => Promise<unknown>, message: string) {
  await assert.rejects(action, (error) => error instanceof TenantDatabaseAccessError, message);
}

async function main() {
  if (process.env.TENANT_ISOLATION_TESTING !== "true" || process.env.NODE_ENV === "production") {
    throw new Error("Release 27 isolation verification is allowed only with TENANT_ISOLATION_TESTING=true outside production.");
  }

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const shop = await platformDb.shop.create({
    data: { name: "Release 27 isolation shop", slug: `release27-isolation-${suffix}` },
  });
  const buyer = await platformDb.buyerAccount.create({
    data: { name: "Release 27 buyer", phone: `+233${String(Date.now()).slice(-9)}` },
  });
  const verification = await platformDb.buyerEmailVerification.create({
    data: {
      buyerId: buyer.id,
      email: `release27-${suffix}@example.test`,
      codeHash: "0".repeat(64),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  try {
    const tenant = createTenantDb(shop.id);
    await expectRejects(
      () => tenant.buyerEmailVerification.findMany(),
      "Tenant client accessed buyer email verification records.",
    );
    await expectRejects(
      () => tenant.$transaction(async (transaction) => transaction.buyerEmailVerification.findMany()),
      "Interactive tenant transaction accessed buyer email verification records.",
    );
    console.log("Release 27 buyer email verification isolation passed for normal and interactive tenant clients.");
  } finally {
    await platformDb.buyerEmailVerification.deleteMany({ where: { id: verification.id } });
    await platformDb.buyerAccount.deleteMany({ where: { id: buyer.id } });
    await platformDb.shop.deleteMany({ where: { id: shop.id } });
    await platformDb.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
