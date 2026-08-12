import { AsyncLocalStorage } from "node:async_hooks";

type TenantRequestContext = {
  shopId: string | null;
};

const globalForTenantContext = globalThis as unknown as {
  tenantRequestContext?: AsyncLocalStorage<TenantRequestContext>;
};

const tenantRequestContext =
  globalForTenantContext.tenantRequestContext ?? new AsyncLocalStorage<TenantRequestContext>();

globalForTenantContext.tenantRequestContext = tenantRequestContext;

export function bindTenantRequestContext(shopId: string | null) {
  tenantRequestContext.enterWith({ shopId: shopId?.trim() || null });
}

export function currentTenantShopId() {
  return tenantRequestContext.getStore()?.shopId ?? null;
}

export function runWithTenantRequestContext<T>(shopId: string | null, callback: () => T) {
  return tenantRequestContext.run({ shopId: shopId?.trim() || null }, callback);
}
