import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("Release 26 public business applications", () => {
  it("stores only hashed status tokens and keeps private tokens out of URLs", () => {
    const actions = source("app/apply/actions.ts");
    const helpers = source("lib/business-applications.ts");
    const submitted = source("app/apply/submitted/page.tsx");
    expect(actions).toContain("hashApplicationStatusToken(statusToken)");
    expect(actions).toContain("setApplicationReceiptCookie");
    expect(actions).toContain("setApplicationAccessCookie");
    expect(actions).not.toMatch(/redirect\([^)]*statusToken/);
    expect(helpers).toContain('httpOnly: true');
    expect(helpers).toContain('sameSite: "lax"');
    expect(helpers).toContain("timingSafeEqual");
    expect(submitted).toContain("private status token");
  });

  it("rate-limits submission and status lookup and blocks duplicate open applications", () => {
    const actions = source("app/apply/actions.ts");
    expect(actions).toContain("application:request:");
    expect(actions).toContain("application:identity:");
    expect(actions).toContain("application:status:");
    expect(actions).toContain("duplicateFingerprint");
    expect(actions).toContain("openApplicationStatuses");
    expect(actions).toContain("verificationStatus: ShopVerificationStatus.VERIFIED");
  });

  it("exposes only applicant-safe status fields", () => {
    const helpers = source("lib/business-applications.ts");
    const result = source("app/apply/status/result/page.tsx");
    expect(helpers).toContain("decisionReason: true");
    expect(helpers).not.toContain("reviewNotes: true");
    expect(result).not.toContain("assignedReviewerId");
    expect(result).not.toContain("approvedOwnerUserId");
    expect(result).not.toContain("statusTokenHash");
  });
});

describe("Release 26 administrator application approvals", () => {
  it("requires the shops permission and serializable audited transactions", () => {
    const actions = source("app/admin/applications/actions.ts");
    expect(actions.match(/requirePlatformPermission\("shops"\)/g)?.length).toBe(5);
    expect(actions).toContain("Prisma.TransactionIsolationLevel.Serializable");
    expect(actions).toContain("admin.business_application_review_started");
    expect(actions).toContain("admin.shop_application_approved");
    expect(actions).toContain("admin.supplier_application_approved");
    expect(actions).toContain("expectedUpdatedAt");
  });

  it("creates shops only from configured plans and preserves pending verification", () => {
    const actions = source("app/admin/applications/actions.ts");
    expect(actions).toContain("!plan.isConfigured");
    expect(actions).toContain("resolvePlanPrice(plan, parsed.data.billingCycle)");
    expect(actions).toContain("verificationStatus: ShopVerificationStatus.PENDING");
    expect(actions).toContain("storefrontEnabled: false");
    expect(actions).toContain("publicOrderingEnabled: false");
    expect(actions).toContain("shopSubscriptionContract.create");
    expect(actions).toContain("shopCommunicationWallet.createMany");
    expect(actions).toContain("credentialDelivery: \"out-of-band\"");
  });

  it("creates supplier access under one exact reviewed shop relationship", () => {
    const actions = source("app/admin/applications/actions.ts");
    expect(actions).toContain("application.requestedShopId !== shop.id");
    expect(actions).toContain("role: Role.SUPPLIER");
    expect(actions).toContain("shopId: shop.id");
    expect(actions).toContain("portalUserId: portalUser.id");
    expect(actions).not.toContain("shopId: application.approvedShopId");
  });

  it("keeps application models platform-only in normal and interactive tenant clients", () => {
    const tenantDb = source("lib/tenant-db.ts");
    const verifier = source("../scripts/verify-tenant-isolation.ts");
    expect(tenantDb).toContain('businessApplication: "BusinessApplication"');
    expect(verifier).toContain("Tenant client accessed platform business applications");
    expect(verifier).toContain("Interactive tenant transaction accessed business applications");
  });
});
