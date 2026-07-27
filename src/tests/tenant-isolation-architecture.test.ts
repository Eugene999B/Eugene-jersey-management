import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

function filesBelow(relativeRoot: string) {
  const absoluteRoot = new URL(`../${relativeRoot}`, import.meta.url).pathname;
  const results: string[] = [];

  function visit(directory: string) {
    for (const entry of readdirSync(directory)) {
      const absolute = join(directory, entry);
      if (statSync(absolute).isDirectory()) visit(absolute);
      else if (/\.(ts|tsx)$/.test(entry)) results.push(relative(absoluteRoot, absolute));
    }
  }

  visit(absoluteRoot);
  return results.map((path) => `${relativeRoot}/${path.replaceAll("\\", "/")}`);
}

describe("structural tenant isolation", () => {
  it("binds the verified shop to async request context after unrestricted session validation", () => {
    const auth = source("lib/auth.ts");
    expect(auth).toContain('import { platformDb } from "@/lib/platform-db"');
    expect(auth).toContain("bindTenantRequestContext(null)");
    expect(auth).toContain("platformDb.user.findUnique");
    expect(auth).toContain("bindTenantRequestContext(session.shopId)");
  });

  it("routes the compatibility database client through the active tenant client", () => {
    const database = source("lib/db.ts");
    expect(database).toContain("currentTenantShopId()");
    expect(database).toContain("createTenantDb(shopId)");
    expect(database).toContain("new Proxy(platformDb");
  });

  it("fails closed for direct models, child relations, interactive transactions, global models, and raw SQL", () => {
    const tenantDb = source("lib/tenant-db.ts");
    expect(tenantDb).toContain('ProductVariant: (shopId) => ({ product: { shopId } })');
    expect(tenantDb).toContain('Payment: (shopId) => ({ order: { shopId } })');
    expect(tenantDb).toContain("createTenantTransactionDb(transaction, shopId)");
    expect(tenantDb).toContain("is platform-global or has a multi-tenant ownership rule");
    expect(tenantDb).toContain('"$queryRaw"');
    expect(tenantDb).toContain('"$executeRawUnsafe"');
  });

  it("prevents tenant workspaces from importing the unrestricted platform client", () => {
    const protectedRoots = [
      "app/dashboard",
      "app/supplier",
      "app/api/pos",
      "app/api/orders",
      "app/api/receipts",
      "app/api/exports",
    ];
    const protectedFiles = protectedRoots.flatMap(filesBelow);
    expect(protectedFiles.length).toBeGreaterThan(20);

    for (const file of protectedFiles) {
      const content = source(file);
      expect(content, `${file} imports unrestricted platform access`).not.toContain("@/lib/platform-db");
      expect(content, `${file} performs raw SQL`).not.toMatch(/\$(?:queryRaw|executeRaw)/);
    }
  });

  it("keeps a guarded two-shop PostgreSQL verification in the release pipeline", () => {
    const packageJson = source("../package.json");
    const workflow = source("../.github/workflows/validate.yml");
    const verifier = source("../scripts/verify-tenant-isolation.ts");
    expect(packageJson).toContain('"test:tenant-isolation": "tsx scripts/verify-tenant-isolation.ts"');
    expect(workflow).toContain("Run two-shop tenant isolation verification");
    expect(workflow).toContain('TENANT_ISOLATION_TESTING: "true"');
    expect(verifier).toContain("Interactive transaction bypassed tenant scope");
    expect(verifier).toContain("Tenant client accessed a platform-global model");
  });
});
