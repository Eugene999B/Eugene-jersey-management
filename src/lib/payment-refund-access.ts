import { Role } from "@prisma/client";

export const paymentRefundRoles: Role[] = [Role.OWNER, Role.MANAGER, Role.ACCOUNTANT];

export function canManagePaymentRefunds(role: Role) {
  return paymentRefundRoles.includes(role);
}
