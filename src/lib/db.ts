import { platformDb } from "@/lib/platform-db";
import { createTenantDb } from "@/lib/tenant-db";
import { currentTenantShopId } from "@/lib/tenant-context";

const tenantClients = new Map<string, ReturnType<typeof createTenantDb>>();

function activeDatabaseClient() {
  const shopId = currentTenantShopId();
  if (!shopId) return platformDb;

  const existing = tenantClients.get(shopId);
  if (existing) return existing;

  const scoped = createTenantDb(shopId);
  tenantClients.set(shopId, scoped);
  return scoped;
}

/**
 * Context-aware compatibility client.
 *
 * Authentication binds a verified shop to the current async request. From
 * that point, existing `prisma` imports automatically use a fail-closed,
 * tenant-scoped client. Platform administration and infrastructure code run
 * without tenant context and therefore use the explicit unrestricted client.
 */
export const prisma = new Proxy(platformDb, {
  get(_target, property) {
    const client = activeDatabaseClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
