import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GHANA_REGIONS, canonicalGhanaRegion } from "@/lib/ghana-locations";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("structured Ghana business locations", () => {
  it("keeps the official sixteen-region top level canonical and unique", () => {
    expect(GHANA_REGIONS).toHaveLength(16);
    expect(new Set(GHANA_REGIONS.map((item) => item.name)).size).toBe(16);
    expect(new Set(GHANA_REGIONS.map((item) => item.code)).size).toBe(16);
    expect(canonicalGhanaRegion("Greater Accra Region")).toBe("Greater Accra");
    expect(canonicalGhanaRegion("not a Ghana region")).toBeNull();
  });

  it("loads current districts and communities through the official Ghana directory with a manual fallback", () => {
    const route = source("../app/api/ghana-locations/route.ts");
    expect(route).toContain("registry.mogcsp.gov.gh/api/locations");
    expect(route).toContain('registryLocations("D"');
    expect(route).toContain('registryLocations("C"');
    expect(route).toContain("manualEntryAllowed: true");
    expect(route).toContain("revalidate: 24 * 60 * 60");
  });

  it("persists registration and shop settings locations separately from legacy address text", () => {
    const model = source("../../prisma/models/ghana-business-location.prisma");
    const migration = source("../../prisma/migrations/20260729033000_release36_ghana_business_locations/migration.sql");
    const application = source("../app/apply/actions.ts");
    const settings = source("../app/dashboard/settings/actions.ts");
    const profileStore = source("../lib/shop-profile-store.ts");

    expect(model).toContain("model ShopLocation");
    expect(model).toContain("model BusinessApplicationLocation");
    expect(model).toContain("digitalAddress String?");
    expect(model).toContain("@@index([region, district, town])");
    expect(migration).toContain("BusinessApplication_sync_shop_location");
    expect(application).toContain("businessApplicationLocation.create");
    expect(settings).toContain("saveShopProfileBundle");
    expect(profileStore).toContain("tx.shopLocation.upsert");
    expect(profileStore).toContain("where: { shopId: input.shopId }");
  });

  it("makes marketplace search aware of administrative and product details", () => {
    const marketplace = source("../app/shops/page.tsx");
    const filters = source("../components/marketplace/marketplace-location-filters.tsx");

    for (const field of ["region", "district", "city", "suburb", "category", "brand", "team", "condition", "availability"]) {
      expect(marketplace).toContain(field);
    }
    expect(marketplace).toContain("shopLocation.findMany");
    expect(marketplace).toContain("searchText");
    expect(filters).toContain("GHANA_REGIONS");
    expect(filters).toContain("level=districts");
    expect(filters).toContain("level=communities");
  });
});
