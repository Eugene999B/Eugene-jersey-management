import { Role } from "@prisma/client";

export const roleLabels: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  OWNER: "Owner",
  MANAGER: "Manager",
  CASHIER: "Cashier",
  DESIGNER: "Designer",
  INVENTORY_CLERK: "Inventory Clerk",
  ACCOUNTANT: "Accountant",
  VIEWER: "Viewer",
  SUPPLIER: "Supplier",
};

export const permissions = {
  superAdmin: [Role.SUPER_ADMIN],
  dashboard: [
    Role.OWNER,
    Role.MANAGER,
    Role.CASHIER,
    Role.DESIGNER,
    Role.INVENTORY_CLERK,
    Role.ACCOUNTANT,
    Role.VIEWER,
  ],
  catalogWrite: [Role.OWNER, Role.MANAGER, Role.INVENTORY_CLERK],
  pos: [Role.OWNER, Role.MANAGER, Role.CASHIER],
  orders: [Role.OWNER, Role.MANAGER, Role.CASHIER, Role.DESIGNER],
  orderFinance: [Role.OWNER, Role.MANAGER, Role.CASHIER, Role.ACCOUNTANT],
  reports: [Role.OWNER, Role.MANAGER, Role.ACCOUNTANT],
  debts: [Role.OWNER, Role.MANAGER, Role.CASHIER, Role.ACCOUNTANT],
  messages: [Role.OWNER, Role.MANAGER, Role.CASHIER],
  designs: [Role.OWNER, Role.MANAGER, Role.DESIGNER],
  activity: [Role.OWNER, Role.MANAGER],
  closing: [Role.OWNER, Role.MANAGER, Role.CASHIER, Role.ACCOUNTANT],
  suppliers: [Role.OWNER, Role.MANAGER, Role.INVENTORY_CLERK, Role.ACCOUNTANT],
  network: [Role.OWNER, Role.MANAGER],
  exports: [Role.OWNER, Role.MANAGER, Role.ACCOUNTANT],
  staff: [Role.OWNER, Role.MANAGER],
  settings: [Role.OWNER, Role.MANAGER],
} satisfies Record<string, Role[]>;

export type SessionUser = {
  id: string;
  shopId: string | null;
  email: string;
  name: string;
  role: Role;
};

export function hasRole(user: Pick<SessionUser, "role"> | null | undefined, allowedRoles: Role[]) {
  if (!user) return false;
  return allowedRoles.includes(user.role);
}

export function assertRole(user: Pick<SessionUser, "role"> | null | undefined, allowedRoles: Role[]) {
  if (!hasRole(user, allowedRoles)) {
    throw new Error("You do not have permission to perform this action.");
  }
}

export function canSeeNav(role: Role) {
  return {
    dashboard: true,
    catalog: hasRole({ role }, [Role.OWNER, Role.MANAGER, Role.INVENTORY_CLERK, Role.VIEWER]),
    orders: hasRole({ role }, [...permissions.orders, Role.VIEWER]),
    pos: hasRole({ role }, permissions.pos),
    customers: hasRole({ role }, [Role.OWNER, Role.MANAGER, Role.CASHIER, Role.ACCOUNTANT, Role.VIEWER]),
    reports: hasRole({ role }, [...permissions.reports, Role.VIEWER]),
    debts: hasRole({ role }, permissions.debts),
    messages: hasRole({ role }, permissions.messages),
    designs: hasRole({ role }, permissions.designs),
    activity: hasRole({ role }, permissions.activity),
    closing: hasRole({ role }, permissions.closing),
    suppliers: hasRole({ role }, permissions.suppliers),
    network: hasRole({ role }, permissions.network),
    exports: hasRole({ role }, permissions.exports),
    staff: hasRole({ role }, permissions.staff),
    settings: hasRole({ role }, permissions.settings),
  };
}
