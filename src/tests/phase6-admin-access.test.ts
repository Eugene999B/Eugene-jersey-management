import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("Phase 6 administrator-controlled access", () => {
  test("defines every requested access type and expiry outcome in an additive ledger", () => {
    const migration = source("prisma/migrations/20260803003000_phase6_admin_access_grants/migration.sql");
    for (const type of ["PAID", "FREE_TRIAL", "SPONSORED", "PROMOTIONAL", "FREE_FOREVER", "EMERGENCY", "SUSPENDED"]) {
      expect(migration).toContain(`'${type}'`);
    }
    for (const outcome of ["EXTEND_AUTOMATICALLY", "RETURN_TO_FREE", "MOVE_TO_PAID", "SUSPEND_ACTIONS", "ADMIN_REVIEW"]) {
      expect(migration).toContain(`'${outcome}'`);
    }
    expect(migration).toContain('CREATE TABLE "ShopAccessGrant"');
    expect(migration).toContain('"invoicesDisabled" BOOLEAN NOT NULL DEFAULT false');
    expect(migration).toContain('"approvedById" TEXT NOT NULL');
    expect(migration).toContain('"termsSnapshot" JSONB NOT NULL');
    expect(migration).toContain('CREATE UNIQUE INDEX "ShopAccessGrant_one_active_per_shop"');
    expect(migration).not.toContain("DELETE FROM");
  });

  test("records immutable commercial terms and explicit expiry handling", () => {
    const access = source("src/lib/subscription-access.ts");
    expect(access).toContain("accessGrantSnapshot");
    expect(access).toContain("featureOverrides");
    expect(access).toContain("reconcileExpiredShopAccessGrant");
    expect(access).toContain("EXTEND_AUTOMATICALLY");
    expect(access).toContain("RETURN_TO_FREE");
    expect(access).toContain("MOVE_TO_PAID");
    expect(access).toContain("COMMERCIAL_ACTIONS_SUSPENDED");
    expect(access).toContain("ADMIN_REVIEW_REQUIRED");
    expect(access).toContain("TransactionIsolationLevel.Serializable");
  });

  test("requires billing permission and audits grants and revocations", () => {
    const actions = source("src/app/admin/access/actions.ts");
    expect(actions.match(/requirePlatformPermission\("billing"\)/g)?.length).toBe(2);
    expect(actions).toContain("admin.shop_access_granted");
    expect(actions).toContain("admin.shop_access_revoked");
    expect(actions).toContain("Superseded by a new");
    expect(actions).toContain("termsSnapshot");
    expect(actions).toContain("priceOverride");
    expect(actions).toContain("approvedById: session.id");
  });

  test("suppresses invoices and payment prompts without bypassing saved plan limits", () => {
    const billing = source("src/lib/subscription-billing.ts");
    const hardening = source("src/lib/subscription-hardening.ts");
    const page = source("src/app/dashboard/subscription/page.tsx");
    expect(billing).toContain("accessGrant?.invoicesDisabled");
    expect(billing).toContain('invoice-disabled-by-access-grant');
    expect(billing).toContain("accessGrant?.priceOverride");
    expect(hardening).toContain("accessGrant.snapshot");
    expect(hardening).toContain("assertProductCreationAvailable");
    expect(hardening).toContain("assertOrderCreationAvailable");
    expect(page).toContain("Administrator access grant");
    expect(page).toContain("!usage.accessGrant?.invoicesDisabled");
    expect(page).toContain("No subscription invoice is required while this administrator access grant is active.");
  });

  test("voids outstanding invoices when a no-invoice grant begins", () => {
    const actions = source("src/app/admin/access/actions.ts");
    expect(actions).toContain("SubscriptionInvoiceStatus.OPEN");
    expect(actions).toContain("SubscriptionInvoiceStatus.OVERDUE");
    expect(actions).toContain("SubscriptionInvoiceStatus.VOID");
    expect(actions).toContain("Invoice suppressed by");
    expect(actions).toContain("nextReminderAt: null");
  });

  test("places access grants behind administrator billing permission", () => {
    const navigation = source("src/lib/admin-navigation.ts");
    const page = source("src/app/admin/access/page.tsx");
    expect(navigation).toContain('href: "/admin/access"');
    expect(navigation).toContain('permission: "billing"');
    expect(page).toContain('requirePlatformPermission("billing")');
    expect(page).toContain("Access grant ledger");
    expect(page).toContain("ConfirmActionButton");
  });

  test("keeps the grant ledger outside tenant-owned database models", () => {
    const tenantDb = source("src/lib/tenant-db.ts");
    expect(tenantDb).not.toContain('"ShopAccessGrant",');
    expect(tenantDb).toContain("is platform-global or has an unsupported ownership rule");
    const protectedRoots = [
      source("src/app/dashboard/subscription/page.tsx"),
      source("src/app/dashboard/subscription/actions.ts"),
    ];
    for (const file of protectedRoots) expect(file).not.toContain("@/lib/platform-db");
  });
});
