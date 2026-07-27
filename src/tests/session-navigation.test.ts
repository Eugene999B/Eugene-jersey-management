import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { isTrustedApplicationOrigin } from "@/lib/request-origin";
import { signSession, verifySessionToken } from "@/lib/session-token";
import { MissingTenantScopeError, requireTenantShopId, withTenantScope } from "@/lib/tenant-scope";

function source(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("session navigation safety", () => {
  it("keeps GET logout non-destructive and performs logout only with POST", () => {
    const staffLogout = source("app/logout/route.ts");
    const buyerLogout = source("app/buyer/logout/route.ts");
    for (const route of [staffLogout, buyerLogout]) {
      expect(route).toContain("export async function GET");
      expect(route).toContain("export async function POST");
      const getHandler = route.split("export async function GET")[1]?.split("export async function POST")[0] ?? "";
      expect(getHandler).not.toContain("cookies.delete");
      expect(getHandler).not.toContain("clearSession");
      expect(route).toContain("response.cookies.delete");
    }
  });

  it("contains no prefetchable logout links in authenticated workspaces", () => {
    const files = [source("app/admin/layout.tsx"), source("app/dashboard/layout.tsx"), source("components/dashboard/sidebar.tsx"), source("app/supplier/page.tsx"), source("app/shops/page.tsx")];
    for (const file of files) {
      expect(file).not.toContain('href="/logout"');
      expect(file).not.toContain('href="/buyer/logout"');
    }
  });

  it("uses dedicated admin routes instead of one-page section anchors", () => {
    const navigation = source("components/admin/admin-navigation.tsx");
    const routes = ["/admin", "/admin/shops", "/admin/staff", "/admin/support", "/admin/billing", "/admin/activity", "/admin/security", "/admin/settings"];
    for (const route of routes) expect(navigation).toContain(`href: "${route}"`);
    expect(navigation).not.toContain("/admin#");
    expect(source("app/admin/layout.tsx")).toContain('href="/admin/support"');
  });

  it("gives every admin responsibility its own page and permission boundary", () => {
    const pages = [
      ["app/admin/shops/page.tsx", 'requirePlatformPermission("shops")'],
      ["app/admin/staff/page.tsx", 'requirePlatformPermission("workers")'],
      ["app/admin/support/page.tsx", 'requirePlatformPermission("support")'],
      ["app/admin/billing/page.tsx", 'requirePlatformPermission("billing")'],
      ["app/admin/activity/page.tsx", 'requirePlatformPermission("activity")'],
      ["app/admin/security/page.tsx", 'requirePlatformPermission("settings")'],
      ["app/admin/settings/page.tsx", 'requirePlatformPermission("settings")'],
    ] as const;
    for (const [path, guard] of pages) expect(source(path)).toContain(guard);
    const overview = source("app/admin/page.tsx");
    expect(overview).not.toContain("createPlatformWorkerAction");
    expect(overview).not.toContain("updateReturnIssueAction");
    expect(overview).not.toContain("updateShopSubscriptionAction");
  });

  it("signs and verifies a staff session consistently across requests", async () => {
    const previous = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "session-navigation-regression-secret-2026-long-value";
    try {
      const session = { id: "staff-1", shopId: null, email: "admin@example.test", name: "Admin", role: "SUPER_ADMIN" as const, sessionVersion: 4 };
      const token = await signSession(session);
      await expect(verifySessionToken(token)).resolves.toEqual(session);
    } finally {
      if (previous === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = previous;
    }
  });

  it("keeps staff credential inputs absent until deliberate user action", () => {
    const form = source("components/auth/staff-login-form.tsx");
    const page = source("app/login/page.tsx");
    const route = source("app/api/auth/login/route.ts");
    expect(form).toContain("credentialsOpen");
    expect(form).toContain("Enter credentials");
    expect(form).toContain("if (!credentialsOpen)");
    expect(form).toContain("readOnly={!identifierUnlocked}");
    expect(form).toContain("readOnly={!passwordUnlocked}");
    expect(form).toContain("userInteractedRef");
    expect(form).toContain("window.setTimeout(clearInjectedValues, 450)");
    expect(form).toContain('autoComplete="new-password"');
    expect(form).not.toContain('autoComplete="username"');
    expect(form).not.toContain('autoComplete="current-password"');
    expect(page).not.toContain("defaultLoginId");
    expect(route).not.toContain('url.searchParams.set("loginId"');
  });
});

describe("tenant and request boundaries", () => {
  it("fails closed when a state-changing request has no Origin header", () => {
    const request = new NextRequest("https://app.example.test/api/designs", { method: "POST" });
    expect(isTrustedApplicationOrigin(request)).toBe(false);
  });

  it("requires a concrete tenant id and never emits undefined shop filters", () => {
    expect(() => requireTenantShopId({ shopId: null })).toThrow(MissingTenantScopeError);
    expect(requireTenantShopId({ shopId: "shop-1" })).toBe("shop-1");
    expect(withTenantScope("shop-1", { id: "order-1" })).toEqual({ id: "order-1", shopId: "shop-1" });
    const receipt = source("app/api/receipts/[orderId]/route.ts");
    expect(receipt).toContain("if (!session.shopId)");
    expect(receipt).toContain("withTenantScope(shopId");
    expect(receipt).not.toContain("session.shopId ?? undefined");
  });
});
