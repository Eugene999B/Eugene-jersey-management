import type { Role } from "@prisma/client";

type DashboardRole = Role | string;

const dashboardRoles = ["OWNER", "MANAGER", "CASHIER", "DESIGNER", "INVENTORY_CLERK", "ACCOUNTANT", "VIEWER"] as const;

const routeRules: Array<{ prefix: string; roles: readonly DashboardRole[] }> = [
  { prefix: "/dashboard/catalog", roles: ["OWNER", "MANAGER", "INVENTORY_CLERK", "VIEWER"] },
  { prefix: "/dashboard/orders", roles: ["OWNER", "MANAGER", "CASHIER", "DESIGNER", "VIEWER"] },
  { prefix: "/dashboard/pos", roles: ["OWNER", "MANAGER", "CASHIER"] },
  { prefix: "/dashboard/customers", roles: ["OWNER", "MANAGER", "CASHIER", "ACCOUNTANT", "VIEWER"] },
  { prefix: "/dashboard/reports", roles: ["OWNER", "MANAGER", "ACCOUNTANT", "VIEWER"] },
  { prefix: "/dashboard/debts", roles: ["OWNER", "MANAGER", "CASHIER", "ACCOUNTANT"] },
  { prefix: "/dashboard/messages", roles: ["OWNER", "MANAGER", "CASHIER"] },
  { prefix: "/dashboard/designs", roles: ["OWNER", "MANAGER", "DESIGNER"] },
  { prefix: "/dashboard/activity", roles: ["OWNER", "MANAGER"] },
  { prefix: "/dashboard/closing", roles: ["OWNER", "MANAGER", "CASHIER", "ACCOUNTANT"] },
  { prefix: "/dashboard/suppliers", roles: ["OWNER", "MANAGER", "INVENTORY_CLERK", "ACCOUNTANT"] },
  { prefix: "/dashboard/network", roles: ["OWNER", "MANAGER"] },
  { prefix: "/dashboard/commerce", roles: ["OWNER", "MANAGER", "ACCOUNTANT"] },
  { prefix: "/dashboard/exports", roles: ["OWNER", "MANAGER", "ACCOUNTANT"] },
  { prefix: "/dashboard/staff", roles: ["OWNER", "MANAGER"] },
  { prefix: "/dashboard/settings", roles: ["OWNER", "MANAGER"] },
  { prefix: "/dashboard", roles: dashboardRoles },
];

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function dashboardRolesForPath(pathname: string) {
  return routeRules.find((rule) => matchesPrefix(pathname, rule.prefix))?.roles ?? dashboardRoles;
}

export function canAccessDashboardPath(pathname: string, role: DashboardRole | null | undefined) {
  if (!role) return false;
  return dashboardRolesForPath(pathname).includes(role);
}
