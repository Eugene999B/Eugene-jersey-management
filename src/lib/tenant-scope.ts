import type { SessionUser } from "@/lib/rbac";

export class MissingTenantScopeError extends Error {
  constructor() {
    super("A shop-scoped operation requires an authenticated shop context.");
    this.name = "MissingTenantScopeError";
  }
}

export function requireTenantShopId(session: Pick<SessionUser, "shopId">) {
  if (!session.shopId) throw new MissingTenantScopeError();
  return session.shopId;
}

export function withTenantScope<T extends Record<string, unknown>>(shopId: string, where: T) {
  if (!shopId.trim()) throw new MissingTenantScopeError();
  return { ...where, shopId } as T & { shopId: string };
}
