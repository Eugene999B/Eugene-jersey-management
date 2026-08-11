import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ShopVerificationStatus } from "@prisma/client";
import { publicShopAcceptsOrders } from "@/lib/public-shop-access";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("Phase 19F verified public commerce", () => {
  it("requires a verified active shop with public ordering enabled", () => {
    const base = { isActive: true, verificationStatus: ShopVerificationStatus.VERIFIED, storefrontEnabled: true, publicOrderingEnabled: true, enabledModules: ["ONLINE_SELLING"] };
    expect(publicShopAcceptsOrders(base)).toBe(true);
    expect(publicShopAcceptsOrders({ ...base, verificationStatus: ShopVerificationStatus.PENDING })).toBe(false);
    expect(publicShopAcceptsOrders({ ...base, storefrontEnabled: false })).toBe(false);
  });

  it("uses the shared verified-shop check in direct public order and custom-production entry points", () => {
    expect(source("src/app/api/public-order/route.ts")).toContain("publicShopAcceptsOrders(shop)");
    expect(source("src/app/shop/[slug]/custom-production/actions.ts")).toContain('publicShopAcceptsOrders(shop, ["ONLINE_SELLING", "PRINTING_PRODUCTION"])');
  });

  it("also enforces verified ONLINE orders at the database boundary", () => {
    const migration = source("prisma/migrations/20260811190000_phase19f_public_customer_guards/migration.sql");
    expect(migration).toContain('NEW."channel" = \'ONLINE\'');
    expect(migration).toContain('s."verificationStatus" = \'VERIFIED\'');
    expect(migration).toContain("EJM_PUBLIC_SHOP_NOT_VERIFIED");
  });
});

describe("Phase 19F customer identity", () => {
  it("normalizes email and serializes dashboard customer writes", () => {
    const actions = source("src/app/dashboard/customers/actions.ts");
    expect(actions).toContain("value.toLowerCase()");
    expect(actions).toContain("Prisma.TransactionIsolationLevel.Serializable");
    expect(actions).toContain('mode: "insensitive" as const');
  });

  it("prevents new duplicate phone/email identities at PostgreSQL even across different entry points", () => {
    const migration = source("prisma/migrations/20260811190000_phase19f_public_customer_guards/migration.sql");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("EJM_CUSTOMER_IDENTITY_DUPLICATE");
    expect(migration).toContain("lower(c.\"email\") = NEW.\"email\"");
  });

  it("serializes public order customer matching and uses case-insensitive email", () => {
    const route = source("src/app/api/public-order/route.ts");
    expect(route).toContain("Prisma.TransactionIsolationLevel.Serializable");
    expect(route).toContain('mode: "insensitive" as const');
    expect(route).toContain("buyer.email?.trim().toLowerCase()");
  });
});

describe("Phase 19F artwork capacity", () => {
  it("row-locks each request before enforcing the six-artwork limit", () => {
    const migration = source("prisma/migrations/20260811190000_phase19f_public_customer_guards/migration.sql");
    expect(migration).toContain('FROM "CustomerProductionRequest" r');
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("asset_count >= 6");
    expect(migration).toContain("EJM_CUSTOMER_ARTWORK_LIMIT");
  });
});
