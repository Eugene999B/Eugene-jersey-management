import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("sole administrator and shop usability architecture", () => {
  it("applies commercial changes immediately while preserving immutable versions", () => {
    const plans = source("app/admin/billing/actions.ts");
    const credits = source("app/admin/billing/communication-actions.ts");
    expect(plans).toContain("saveSubscriptionPlanAction");
    expect(plans).toContain("subscriptionPlanVersion.create");
    expect(plans).toContain("appliedImmediately: true");
    expect(plans).not.toContain("canApproveCommercialChange");
    expect(credits).toContain("saveCommunicationPackageAction");
    expect(credits).toContain("communicationCreditPackageVersion.create");
    expect(credits).not.toContain("canApproveCommercialChange");
  });

  it("maps the shop owner Login ID to the authenticating user and backfills existing owners", () => {
    const createShop = source("app/admin/create-shop-action.ts");
    const migration = source("../prisma/migrations/20260728213000_shop_owner_login_ids/migration.sql");
    expect(createShop).toContain("adminLoginId: proposedStaffLoginId");
    expect(migration).toContain('SET "adminLoginId" = shop."staffLoginId"');
    expect(migration).toContain('owner."role" = \'OWNER\'');
  });

  it("keeps registration separate from voluntary storefront visibility", () => {
    const settings = source("app/dashboard/settings/actions.ts");
    const page = source("app/dashboard/settings/page.tsx");
    expect(settings).toContain("updateStorefrontVisibilityAction");
    expect(settings).toContain('z.enum(["ONLINE", "BROWSE", "OFFLINE"])');
    expect(page).toContain("Registration keeps your private shop workspace active");
    expect(page).toContain("Online + ordering");
    expect(page).toContain("Visible, orders paused");
  });
});
