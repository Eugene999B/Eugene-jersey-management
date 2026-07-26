import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { canAccessDashboardPath, dashboardRolesForPath } from "@/lib/dashboard-access";

describe("dashboard page gates", () => {
  it("maps nested paths to the tightest matching rule", () => {
    expect(dashboardRolesForPath("/dashboard/pos")).toEqual(["OWNER", "MANAGER", "CASHIER"]);
    expect(dashboardRolesForPath("/dashboard/designs")).toContain("DESIGNER");
    expect(dashboardRolesForPath("/dashboard/settings/payments")).toEqual(["OWNER", "MANAGER"]);
    expect(dashboardRolesForPath("/dashboard")).toContain("VIEWER");
  });

  it("blocks cashier from staff and design routes", () => {
    expect(canAccessDashboardPath("/dashboard/staff", Role.CASHIER)).toBe(false);
    expect(canAccessDashboardPath("/dashboard/designs", Role.CASHIER)).toBe(false);
    expect(canAccessDashboardPath("/dashboard/pos", Role.CASHIER)).toBe(true);
  });

  it("blocks designer from POS settings and staff", () => {
    expect(canAccessDashboardPath("/dashboard/pos", Role.DESIGNER)).toBe(false);
    expect(canAccessDashboardPath("/dashboard/settings", Role.DESIGNER)).toBe(false);
    expect(canAccessDashboardPath("/dashboard/staff", Role.DESIGNER)).toBe(false);
    expect(canAccessDashboardPath("/dashboard/designs", Role.DESIGNER)).toBe(true);
  });

  it("allows owner on every operational module", () => {
    const paths = [
      "/dashboard",
      "/dashboard/catalog",
      "/dashboard/pos",
      "/dashboard/designs",
      "/dashboard/staff",
      "/dashboard/settings",
      "/dashboard/network",
      "/dashboard/exports",
    ];
    for (const path of paths) {
      expect(canAccessDashboardPath(path, Role.OWNER)).toBe(true);
    }
  });
});
