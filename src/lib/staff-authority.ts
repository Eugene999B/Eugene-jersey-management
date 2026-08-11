import { Role } from "@prisma/client";

export const ownerAssignableStaffRoles: readonly Role[] = [
  Role.MANAGER,
  Role.CASHIER,
  Role.DESIGNER,
  Role.INVENTORY_CLERK,
  Role.ACCOUNTANT,
  Role.VIEWER,
];

export const managerAssignableStaffRoles: readonly Role[] = [
  Role.CASHIER,
  Role.DESIGNER,
  Role.INVENTORY_CLERK,
  Role.ACCOUNTANT,
  Role.VIEWER,
];

export function assignableStaffRoles(actorRole: Role): readonly Role[] {
  if (actorRole === Role.OWNER) return ownerAssignableStaffRoles;
  if (actorRole === Role.MANAGER) return managerAssignableStaffRoles;
  return [];
}

export function canAssignStaffRole(actorRole: Role, targetRole: Role) {
  return assignableStaffRoles(actorRole).includes(targetRole);
}

export function canToggleStaffAccess(actorRole: Role, targetRole: Role) {
  if (targetRole === Role.OWNER) return false;
  if (actorRole === Role.OWNER) return ownerAssignableStaffRoles.includes(targetRole);
  if (actorRole === Role.MANAGER) return managerAssignableStaffRoles.includes(targetRole);
  return false;
}
