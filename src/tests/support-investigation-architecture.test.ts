import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("Release 26 investigation and support cases", () => {
  it("keeps every case mutation permission-checked and audited", () => {
    const actions = source("app/admin/support/case-actions.ts");
    expect(actions.match(/requirePlatformPermission\("support"\)/g)?.length).toBe(3);
    expect(actions).toContain("admin.support_case_created");
    expect(actions).toContain("admin.support_case_note_added");
    expect(actions).toContain("admin.support_case_updated");
    expect(actions).toContain("expectedUpdatedAt");
    expect(actions).toContain("allowedTransitions");
  });

  it("keeps investigation read-only and excludes protected credentials", () => {
    const search = source("app/admin/investigate/page.tsx");
    const shopProfile = source("app/admin/investigate/shops/[shopId]/page.tsx");
    expect(search).toContain('requirePlatformPermission("support")');
    expect(shopProfile).toContain('requirePlatformPermission("support")');
    expect(shopProfile).toContain("excludes secret keys, full settlement account numbers");
    expect(shopProfile).not.toContain("passwordHash");
    expect(shopProfile).not.toContain("settlementAccount:");
    expect(shopProfile).not.toContain("paystackSecretKeyRef");
    expect(shopProfile).not.toContain("encryptedSecret");
  });

  it("exposes cases and investigation only through the support permission navigation", () => {
    const navigation = source("components/admin/admin-navigation.tsx");
    expect(navigation).toContain('{ href: "/admin/investigate", label: "Investigation"');
    expect(navigation).toContain('{ href: "/admin/support/cases", label: "Support cases"');
    expect(navigation.match(/permission: "support"/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("retains append-only notes and platform-only tenant denial", () => {
    const models = source("../../prisma/models/support-applications.prisma");
    const tenantDb = source("lib/tenant-db.ts");
    expect(models).toContain("model SupportCaseNote");
    expect(models).not.toMatch(/model SupportCaseNote[\s\S]*?updatedAt/);
    expect(tenantDb).toContain('supportCase: "SupportCase"');
    expect(tenantDb).toContain('supportCaseNote: "SupportCaseNote"');
    expect(tenantDb).toContain('businessApplication: "BusinessApplication"');
  });
});
