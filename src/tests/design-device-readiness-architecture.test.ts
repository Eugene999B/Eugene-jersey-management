import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("Release 29 Design Studio device architecture", () => {
  it("stores shop-owned machine identity and connection routing", () => {
    const model = source("../prisma/models/shop-machine-profile.prisma");
    const migration = source("../prisma/migrations/20260729020000_release29_design_device_readiness/migration.sql");
    expect(model).toContain("manufacturer");
    expect(model).toContain("deviceType");
    expect(model).toContain("connectionMode");
    expect(model).toContain("usbVendorId");
    expect(migration).toContain("WHEN \"outputFormat\" = 'HPGL' THEN 'WEB_SERIAL'");
    expect(migration).toContain("WHEN \"outputFormat\" = 'PRINT_RIP' THEN 'SYSTEM_PRINT'");
  });

  it("validates direct serial use and preserves tenant-scoped API rules", () => {
    const route = source("app/api/design-machine-profiles/route.ts");
    expect(route).toContain("machineProfileCompatibilityError");
    expect(route).toContain("isTrustedApplicationOrigin");
    expect(route).toContain("shopId: access.shopId");
    expect(route).toContain("usbVendorId");
    expect(route).toContain("connectionMode");
  });

  it("shows configured identity separately from browser-visible hardware", () => {
    const panel = source("components/design/machine-profile-panel.tsx");
    const page = source("app/dashboard/designs/page.tsx");
    expect(panel).toContain("Test serial connection");
    expect(panel).toContain("without sending cutter movement commands");
    expect(panel).toContain("compareDetectedHardware");
    expect(panel).toContain("The operating system or vendor/RIP software selects and identifies the physical printer");
    expect(page).toContain("Universal workflow coverage without unsafe protocol claims");
  });
});
