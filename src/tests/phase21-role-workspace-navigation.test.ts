import { Role } from "@prisma/client";
import { describe, expect, test } from "vitest";
import { canAccessDashboardPath } from "@/lib/dashboard-access";
import { canSeeNav, permissions } from "@/lib/rbac";

const shopRoles = [
  Role.OWNER,
  Role.MANAGER,
  Role.CASHIER,
  Role.DESIGNER,
  Role.INVENTORY_CLERK,
  Role.ACCOUNTANT,
  Role.VIEWER,
] as const;

const navRoutes = {
  dashboard: "/dashboard",
  catalog: "/dashboard/catalog",
  orders: "/dashboard/orders",
  pos: "/dashboard/pos",
  customers: "/dashboard/customers",
  reports: "/dashboard/reports",
  debts: "/dashboard/debts",
  messages: "/dashboard/messages",
  designs: "/dashboard/designs",
  activity: "/dashboard/activity",
  closing: "/dashboard/closing",
  suppliers: "/dashboard/suppliers",
  network: "/dashboard/network",
  commerce: "/dashboard/commerce",
  exports: "/dashboard/exports",
  staff: "/dashboard/staff",
  settings: "/dashboard/settings",
  subscription: "/dashboard/subscription",
} as const;

describe("Phase 21 role workspace navigation", () => {
  test("every normal shop role can discover the subscription page it is authorized to open", () => {
    for (const role of shopRoles) {
      expect(permissions.subscription).toContain(role);
      expect(canAccessDashboardPath("/dashboard/subscription", role)).toBe(true);
      expect(canSeeNav(role).subscription).toBe(true);
    }
  });

  test("navigation visibility never disagrees with dashboard route authorization", () => {
    for (const role of shopRoles) {
      const navigation = canSeeNav(role);
      for (const [key, route] of Object.entries(navRoutes)) {
        expect(navigation[key as keyof typeof navigation], `${role} navigation mismatch for ${route}`).toBe(
          canAccessDashboardPath(route, role),
        );
      }
    }
  });

  test("restricted roles keep high-risk workspaces out of both navigation and direct access", () => {
    expect(canSeeNav(Role.CASHIER).staff).toBe(false);
    expect(canAccessDashboardPath("/dashboard/staff", Role.CASHIER)).toBe(false);
    expect(canSeeNav(Role.INVENTORY_CLERK).pos).toBe(false);
    expect(canAccessDashboardPath("/dashboard/pos", Role.INVENTORY_CLERK)).toBe(false);
    expect(canSeeNav(Role.ACCOUNTANT).pos).toBe(false);
    expect(canAccessDashboardPath("/dashboard/pos", Role.ACCOUNTANT)).toBe(false);
    expect(canSeeNav(Role.VIEWER).pos).toBe(false);
    expect(canAccessDashboardPath("/dashboard/pos", Role.VIEWER)).toBe(false);
  });
});
