import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  GHANA_LOCATION_CATALOGUE_META,
  bundledDistricts,
  bundledTowns,
  hasBundledDistrict,
} from "@/lib/ghana-location-catalogue";
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

  it("bundles districts and towns so required location fields do not depend on an external service", () => {
    const route = source("../app/api/ghana-locations/route.ts");
    const helper = source("../lib/ghana-location-catalogue.ts");

    expect(GHANA_LOCATION_CATALOGUE_META.regionCount).toBe(16);
    expect(GHANA_LOCATION_CATALOGUE_META.districtCount).toBeGreaterThanOrEqual(200);
    expect(GHANA_LOCATION_CATALOGUE_META.townCount).toBeGreaterThanOrEqual(500);
    expect(route).toContain("bundledDistricts");
    expect(route).toContain("bundledTowns");
    expect(route).toContain("offlineReady: true");
    expect(route).not.toContain("registry.mogcsp.gov.gh");
    expect(route).not.toContain("await fetch(");
    expect(helper).toContain("ghana-location-catalogue.generated.json");
  });

  it("resolves dependent district and town choices from the bundled catalogue", () => {
    const greaterAccra = bundledDistricts("Greater Accra");
    const ashanti = bundledDistricts("Ashanti");

    expect(greaterAccra.some((district) => district.name === "Accra Metropolitan")).toBe(true);
    expect(ashanti.some((district) => district.name === "Kumasi Metropolitan")).toBe(true);
    expect(hasBundledDistrict("Greater Accra", "Accra Metropolitan Assembly")).toBe(true);
    expect(hasBundledDistrict("Ashanti", "Kumasi Metropolitan")).toBe(true);

    const accraTowns = bundledTowns("Greater Accra", "Accra Metropolitan");
    const kumasiTowns = bundledTowns("Ashanti", "Kumasi Metropolitan");
    expect(accraTowns.length).toBeGreaterThan(0);
    expect(kumasiTowns.length).toBeGreaterThan(0);
    expect(new Set(accraTowns.map((town) => town.name)).size).toBe(accraTowns.length);
  });

  it("uses dependent native selects for region, district and town instead of requiring typing", () => {
    const fields = source("../components/locations/ghana-location-fields.tsx");
    const marketplaceFilters = source("../components/marketplace/marketplace-location-filters.tsx");

    expect(fields).toContain('name="region"');
    expect(fields).toContain('name="district"');
    expect(fields).toContain('name="city"');
    expect(fields).toContain("Loading all districts...");
    expect(fields).toContain("Loading all towns and communities...");
    expect(fields).toContain("Retry districts");
    expect(fields).toContain("Retry towns");
    expect(fields).not.toContain("<datalist");
    expect(fields).not.toContain("Choose or type");

    expect(marketplaceFilters).toContain('name="district"');
    expect(marketplaceFilters).toContain('name="city"');
    expect(marketplaceFilters).not.toContain("<datalist");
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
