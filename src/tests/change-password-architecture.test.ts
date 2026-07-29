import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("change password architecture", () => {
  it("requires the current password and revokes workforce and buyer sessions", () => {
    const route = source("../app/api/account/password/route.ts");

    expect(route).toContain("verifyPassword(parsed.currentPassword");
    expect(route).toContain("strongPasswordSchema");
    expect(route).toContain("sessionVersion: { increment: 1 }");
    expect(route).toContain("platformDb.buyerAccount.update");
    expect(route).toContain("response.cookies.delete(SESSION_COOKIE)");
    expect(route).toContain("response.cookies.delete(BUYER_SESSION_COOKIE)");
    expect(route).toContain('action: "auth.password_changed"');
  });

  it("places the shared password panel on workforce and buyer security pages", () => {
    const workforce = source("../app/account/security/page.tsx");
    const buyer = source("../app/buyer/security/page.tsx");
    const panel = source("../components/account/change-password-panel.tsx");

    expect(workforce).toContain("<ChangePasswordPanel />");
    expect(buyer).toContain("<ChangePasswordPanel />");
    expect(panel).toContain('fetch("/api/account/password"');
    expect(panel).toContain("at least 12 characters");
  });
});
