import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { canAccessDashboardPath } from "@/lib/dashboard-access";
import { canSeeNav, hasRole, permissions } from "@/lib/rbac";

describe("RBAC helpers", () => {
  it("allows cashiers to use POS but not reports", () => {
    expect(hasRole({ role: Role.CASHIER }, permissions.pos)).toBe(true);
    expect(hasRole({ role: Role.CASHIER }, permissions.reports)).toBe(false);
  });

  it("keeps designers away from POS and staff screens", () => {
    const nav = canSeeNav(Role.DESIGNER);
    expect(nav.orders).toBe(true);
    expect(nav.pos).toBe(false);
    expect(nav.staff).toBe(false);
  });

  it("permits super admins only on admin surfaces", () => {
    expect(hasRole({ role: Role.SUPER_ADMIN }, permissions.superAdmin)).toBe(true);
    expect(hasRole({ role: Role.SUPER_ADMIN }, permissions.pos)).toBe(false);
  });

  it("blocks direct dashboard URLs that are hidden from a role", () => {
    expect(canAccessDashboardPath("/dashboard/pos", Role.DESIGNER)).toBe(false);
    expect(canAccessDashboardPath("/dashboard/settings", Role.DESIGNER)).toBe(false);
    expect(canAccessDashboardPath("/dashboard/staff", Role.CASHIER)).toBe(false);
    expect(canAccessDashboardPath("/dashboard/designs", Role.CASHIER)).toBe(false);
  });

  it("allows direct dashboard URLs when the role has that module", () => {
    expect(canAccessDashboardPath("/dashboard/pos", Role.CASHIER)).toBe(true);
    expect(canAccessDashboardPath("/dashboard/designs", Role.DESIGNER)).toBe(true);
    expect(canAccessDashboardPath("/dashboard/settings", Role.OWNER)).toBe(true);
    expect(canAccessDashboardPath("/dashboard/reports", Role.ACCOUNTANT)).toBe(true);
  });
});
