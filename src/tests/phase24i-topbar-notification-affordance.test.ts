import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("Phase 24I topbar notification affordance", () => {
  it("does not show an unread control when no notification inbox exists", () => {
    const topbar = source("src/components/dashboard/topbar.tsx");
    expect(topbar).not.toContain("unreadNotifications");
    expect(topbar).not.toContain('title="Notifications"');
    expect(topbar).not.toContain("unread notifications");
  });

  it("keeps the working topbar destinations intact", () => {
    const topbar = source("src/components/dashboard/topbar.tsx");
    expect(topbar).toContain('href="/dashboard/pos"');
    expect(topbar).toContain('href="/account/security"');
    expect(topbar).toContain('href="/dashboard/settings"');
  });
});
