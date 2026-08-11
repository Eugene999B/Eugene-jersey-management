import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("Phase 20 action feedback and recovery", () => {
  test("supplier action redirects have visible operator guidance", () => {
    const actions = source("src/app/dashboard/suppliers/actions.ts");
    const page = source("src/app/dashboard/suppliers/page.tsx");

    for (const code of ["supplier", "portal-email-exists", "order", "order-tenant", "receive", "receive-changed"]) {
      expect(actions).toContain(`error=${code}`);
      expect(page).toContain(`${code}:`);
    }
    expect(page).toContain('role="alert"');
    expect(page).toContain("Refresh and review it before trying again.");
  });

  test("network action redirects have visible operator guidance", () => {
    const actions = source("src/app/dashboard/network/actions.ts");
    const page = source("src/app/dashboard/network/page.tsx");

    for (const code of ["code", "shop", "order", "link", "fulfill", "fulfill-changed"]) {
      expect(actions).toContain(`error=${code}`);
      expect(page).toContain(`${code}:`);
    }
    expect(page).toContain('role="alert"');
    expect(page).toContain("no longer has enough linked stock");
  });

  test("staff validation and invite failures never return to a silent page", () => {
    const actions = source("src/app/dashboard/staff/actions.ts");
    const page = source("src/app/dashboard/staff/page.tsx");

    expect(actions).toContain('staffRedirect("staff")');
    expect(actions).toContain('staffRedirect("invite")');
    expect(page).toContain('params.error === "staff"');
    expect(page).toContain('params.error === "invite"');
    expect(page).toContain('role="alert"');
  });
});
