import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("marketplace brand identity", () => {
  it("stores one isolated marketplace profile per shop", () => {
    const model = source("../../prisma/models/shop-marketplace-profile.prisma");
    const migration = source("../../prisma/migrations/20260729014500_release35_marketplace_branding/migration.sql");

    expect(model).toContain("model ShopMarketplaceProfile");
    expect(model).toContain("shopId       String   @unique");
    expect(model).toContain("tagline      String?");
    expect(model).toContain("heroImageUrl String?");
    expect(migration).toContain('REFERENCES "Shop"("id") ON DELETE CASCADE');
  });

  it("lets a shop upload or clear its selected marketplace photo through a scoped repository", () => {
    const actions = source("../app/dashboard/settings/actions.ts");
    const settings = source("../app/dashboard/settings/page.tsx");
    const profileStore = source("../lib/shop-profile-store.ts");

    expect(actions).toContain('formData.get("marketplaceHeroFile")');
    expect(actions).toContain("saveShopProfileBundle");
    expect(actions).toContain("clearMarketplaceHero");
    expect(profileStore).toContain("tx.shopMarketplaceProfile.upsert");
    expect(profileStore).toContain("where: { shopId: input.shopId }");
    expect(settings).toContain("Marketplace featured photo");
    expect(settings).toContain("Remove the featured photo");
    expect(settings).toContain("Product brands appear automatically");
  });

  it("renders the chosen photo or logo and exposes product brands on marketplace cards", () => {
    const marketplace = source("../app/shops/page.tsx");

    expect(marketplace).toContain("marketplaceProfileByShop");
    expect(marketplace).toContain("profile?.heroImageUrl");
    expect(marketplace).toContain("shop.logoUrl");
    expect(marketplace).toContain("Brands available");
    expect(marketplace).toContain("product.brand");
    expect(marketplace).toContain("backgroundImage");
    expect(marketplace).toContain("object-contain");
  });
});
