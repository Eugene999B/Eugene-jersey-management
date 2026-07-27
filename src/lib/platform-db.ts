import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  platformDb?: PrismaClient;
};

/**
 * Unrestricted database access for platform administration, authentication,
 * infrastructure jobs, and carefully reviewed cross-tenant operations.
 * Tenant workspaces must use createTenantDb() instead.
 */
export const platformDb =
  globalForPrisma.platformDb ??
  new PrismaClient({
    adapter: new PrismaPg(process.env.DATABASE_URL ?? ""),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.platformDb = platformDb;
}
