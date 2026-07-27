import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";

export const platformPermissionValues = ["shops", "billing", "support", "workers", "broadcast", "activity", "security", "settings"] as const;
export type PlatformPermission = (typeof platformPermissionValues)[number];

export const platformPermissionOptions: ReadonlyArray<readonly [PlatformPermission, string]> = [
  ["shops", "Shops"],
  ["billing", "Billing"],
  ["support", "Support"],
  ["workers", "Admin staff"],
  ["broadcast", "Broadcast"],
  ["activity", "Activity"],
  ["security", "Security"],
  ["settings", "Settings"],
];

const platformPermissionRoutes: Record<PlatformPermission, string> = {
  shops: "/admin/shops",
  billing: "/admin/billing",
  support: "/admin/support",
  workers: "/admin/staff",
  broadcast: "/admin/broadcast",
  activity: "/admin/activity",
  security: "/admin/security",
  settings: "/admin/settings",
};

const platformNavigationOrder: PlatformPermission[] = ["shops", "support", "billing", "workers", "broadcast", "activity", "security", "settings"];

export function parsePlatformPermissions(value: unknown): PlatformPermission[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter((item): item is PlatformPermission => platformPermissionValues.includes(item as PlatformPermission));
}

export function resolvePlatformPermissions(value: unknown): PlatformPermission[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  return parsePlatformPermissions(value);
}

export function canAccessPlatformPermission(allowedPermissions: PlatformPermission[] | null, permission: PlatformPermission) {
  return allowedPermissions === null || allowedPermissions.includes(permission);
}

export function platformAdminHomePath(allowedPermissions: PlatformPermission[] | null) {
  if (allowedPermissions === null) return "/admin";
  const firstPermission = platformNavigationOrder.find((permission) => allowedPermissions.includes(permission));
  return firstPermission ? platformPermissionRoutes[firstPermission] : "/admin";
}

export async function getAllowedPlatformPermissions(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { adminPermissions: true } });
  return resolvePlatformPermissions(user?.adminPermissions);
}

export async function requirePlatformPermission(permission?: PlatformPermission) {
  const session = await requireRole(permissions.superAdmin);
  const allowedPermissions = await getAllowedPlatformPermissions(session.id);

  if (permission && !canAccessPlatformPermission(allowedPermissions, permission)) {
    redirect(`${platformAdminHomePath(allowedPermissions)}?error=permission`);
  }

  return session;
}
