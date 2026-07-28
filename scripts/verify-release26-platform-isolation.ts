import "dotenv/config";
import { platformDb } from "../src/lib/platform-db";
import { createTenantDb, TenantDatabaseAccessError } from "../src/lib/tenant-db";

async function expectRejects(operation: () => Promise<unknown>, message: string) {
  try {
    await operation();
  } catch (error) {
    if (error instanceof TenantDatabaseAccessError) return;
    throw error;
  }
  throw new Error(message);
}

async function main() {
  if (process.env.TENANT_ISOLATION_TESTING !== "true" || process.env.NODE_ENV === "production") {
    throw new Error("Release 26 isolation verification is restricted to a disposable non-production database.");
  }

  const tenant = createTenantDb("release26-platform-isolation-shop");
  try {
    await expectRejects(
      () => tenant.supportCase.findMany(),
      "Tenant client accessed Release 26 support cases.",
    );
    await expectRejects(
      () => tenant.$transaction(async (transaction) => transaction.supportCaseNote.findMany()),
      "Interactive tenant transaction accessed Release 26 support case notes.",
    );
    await expectRejects(
      () => tenant.businessApplication.findMany(),
      "Tenant client accessed Release 26 business applications.",
    );
    await expectRejects(
      () => tenant.$transaction(async (transaction) => transaction.businessApplication.findMany()),
      "Interactive tenant transaction accessed Release 26 business applications.",
    );
    console.log("Release 26 support cases, notes and business applications are denied through normal and interactive tenant clients.");
  } finally {
    await platformDb.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await platformDb.$disconnect().catch(() => undefined);
  process.exit(1);
});
