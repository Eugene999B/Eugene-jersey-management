import { BusinessType } from "@prisma/client";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AVAILABLE_OPTIONAL_BUSINESS_MODULES,
  CORE_BUSINESS_MODULES,
  OPTIONAL_BUSINESS_MODULE_KEYS,
  OPTIONAL_BUSINESS_MODULES,
  businessModuleEnabled,
  businessModuleForDashboardPath,
  defaultEnabledModulesForBusinessType,
  normalizeEnabledModules,
} from "@/lib/business-modules";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("Phase 2 business modules", () => {
  it("defines eight universal core modules and eight optional modules", () => {
    expect(CORE_BUSINESS_MODULES.map((module) => module.key)).toEqual([
      "HOME", "SALES", "ORDERS", "ITEMS", "CUSTOMERS", "PAYMENTS", "REPORTS", "SETTINGS",
    ]);
    expect(OPTIONAL_BUSINESS_MODULE_KEYS).toHaveLength(8);
    expect(AVAILABLE_OPTIONAL_BUSINESS_MODULES.map((module) => module.key)).toEqual([
      "PRINTING_PRODUCTION", "SUPPLIERS_PURCHASING", "ONLINE_SELLING", "MARKETPLACE",
    ]);
    expect(OPTIONAL_BUSINESS_MODULES.filter((module) => module.status === "PLANNED")).toHaveLength(4);
  });

  it("assigns safe recommended defaults without enabling unfinished modules", () => {
    expect(defaultEnabledModulesForBusinessType(BusinessType.PRODUCTION_PRINTING)).toEqual([
      "PRINTING_PRODUCTION", "SUPPLIERS_PURCHASING", "ONLINE_SELLING", "MARKETPLACE",
    ]);
    expect(defaultEnabledModulesForBusinessType(BusinessType.RETAIL)).toEqual([
      "SUPPLIERS_PURCHASING", "ONLINE_SELLING", "MARKETPLACE",
    ]);
    expect(defaultEnabledModulesForBusinessType(BusinessType.SERVICES)).toEqual([
      "ONLINE_SELLING", "MARKETPLACE",
    ]);
    expect(defaultEnabledModulesForBusinessType(BusinessType.MIXED)).not.toContain("RENTALS");
  });

  it("normalizes stored values and maps protected dashboard routes", () => {
    expect(normalizeEnabledModules(["MARKETPLACE", "INVALID", "MARKETPLACE", "RENTALS"])).toEqual([
      "RENTALS", "MARKETPLACE",
    ]);
    expect(businessModuleEnabled(["MARKETPLACE"], "MARKETPLACE")).toBe(true);
    expect(businessModuleEnabled([], "MARKETPLACE")).toBe(false);
    expect(businessModuleForDashboardPath("/dashboard/designs/new")?.key).toBe("PRINTING_PRODUCTION");
    expect(businessModuleForDashboardPath("/dashboard/commerce")?.key).toBe("ONLINE_SELLING");
    expect(businessModuleForDashboardPath("/dashboard/pos")).toBeNull();
  });

  it("hides disabled modules, protects direct URLs and exposes administrator controls", () => {
    const layout = source("../app/dashboard/layout.tsx");
    const navigation = source("../lib/shop-navigation.ts");
    const adminActions = source("../app/admin/actions.ts");
    const adminShop = source("../app/admin/shops/[shopId]/page.tsx");
    const subscription = source("../app/dashboard/subscription/page.tsx");
    const moduleAccess = source("../lib/business-module-access.ts");
    const suppliers = source("../app/dashboard/suppliers/actions.ts");
    const designsApi = source("../app/api/designs/route.ts");
    const marketplace = source("../app/shops/page.tsx");

    expect(layout).toContain("businessModuleForDashboardPath");
    expect(layout).toContain("error=module&module=");
    expect(navigation).toContain("requiredModule?: BusinessModuleKey");
    expect(navigation).toContain("businessModuleEnabled(enabledModules, item.requiredModule)");
    expect(adminActions).toContain("updateShopModulesAction");
    expect(adminActions).toContain("admin.shop_modules_updated");
    expect(adminShop).toContain("Save enabled modules");
    expect(subscription).toContain("Disabled modules disappear from navigation");
    expect(moduleAccess).toContain("requireBusinessModuleAccess");
    expect(suppliers).toContain('requireBusinessModuleAccess(shopId, "SUPPLIERS_PURCHASING")');
    expect(designsApi).toContain('businessModuleAccessForShop(shopId, "PRINTING_PRODUCTION")');
    expect(marketplace).toContain('enabledModules: { has: "MARKETPLACE" }');
  });

  it("keeps existing tenants operational and preserves database subscription backstops", () => {
    const migration = source("../../prisma/migrations/20260802184500_phase2_business_modules/migration.sql");
    expect(migration).toContain('ADD COLUMN "enabledModules" TEXT[] NOT NULL');
    expect(migration).toContain("PRINTING_PRODUCTION");
    expect(migration).toContain("p_feature NOT IN ('POS', 'INVENTORY')");
    expect(migration).toContain('CREATE OR REPLACE FUNCTION "ejm_assert_subscription_access"');
  });
});
