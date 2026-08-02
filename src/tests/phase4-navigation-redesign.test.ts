import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("Phase 4 navigation redesign", () => {
  test("uses the required five-place mobile shop navigation", () => {
    const navigation = source("src/lib/shop-navigation.ts");
    const sidebar = source("src/components/dashboard/sidebar.tsx");
    expect(navigation).toContain('["dashboard", "pos", "orders", "catalog"]');
    expect(sidebar).toContain('aria-label="Quick shop navigation"');
    expect(sidebar).toContain('aria-label="Show all shop tools"');
    expect(sidebar).not.toContain("Open all shop tools");
  });

  test("groups shop tools and hides unavailable modules through one catalogue", () => {
    const navigation = source("src/lib/shop-navigation.ts");
    expect(navigation).toContain('"Customers & money"');
    expect(navigation).toContain('"Operations"');
    expect(navigation).toContain('"Management"');
    expect(navigation).toContain("businessModuleEnabled");
    expect(navigation).toContain("includedFeatures.includes");
  });

  test("provides collapsible desktop navigation, breadcrumbs, search and recent tools", () => {
    const shell = source("src/components/dashboard/dashboard-shell.tsx");
    const sidebar = source("src/components/dashboard/sidebar.tsx");
    const topbar = source("src/components/dashboard/topbar.tsx");
    expect(shell).toContain("esm.dashboard.sidebar-collapsed");
    expect(shell).toContain("lg:grid-cols-[84px_minmax(0,1fr)]");
    expect(sidebar).toContain("Recently used");
    expect(sidebar).toContain("item !== undefined");
    expect(sidebar).toContain("!isShopNavigationItemActive(pathname, item.href)");
    expect(topbar).toContain("<DashboardBreadcrumbs");
    expect(topbar).toContain("<DashboardToolSearch");
    expect(topbar).toContain("Quick sale");
  });

  test("groups administrator navigation around platform responsibilities", () => {
    const navigation = source("src/lib/admin-navigation.ts");
    const component = source("src/components/admin/admin-navigation.tsx");
    for (const section of ["Businesses", "Plans & access", "Billing", "Support", "Communications", "Security", "Platform settings"]) {
      expect(navigation).toContain(`"${section}"`);
    }
    expect(component).toContain('aria-label="Quick admin navigation"');
    expect(component).toContain('aria-label="Show all platform tools"');
    expect(component).not.toContain("Open platform tools");
  });

  test("reserves safe mobile space beneath shop and administrator content", () => {
    expect(source("src/components/dashboard/dashboard-shell.tsx")).toContain("5.5rem+env(safe-area-inset-bottom)");
    expect(source("src/app/admin/layout.tsx")).toContain("5.5rem+env(safe-area-inset-bottom)");
  });
});
