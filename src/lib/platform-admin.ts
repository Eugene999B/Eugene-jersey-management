import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";

export const platformPermissionValues = ["shops", "billing", "support", "workers", "broadcast", "activity", "settings"] as const;
export type PlatformPermission = (typeof platformPermissionValues)[number];

export const platformPermissionOptions: ReadonlyArray<readonly [PlatformPermission, string]> = [
  ["shops", "Shops"],
  ["billing", "Billing"],
  ["support", "Support"],
  ["workers", "Admin staff"],
  ["broadcast", "Broadcast"],
  ["activity", "Activity"],
  ["settings", "Settings and security"],
];

export function parsePlatformPermissions(value: unknown): PlatformPermission[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter((item): item is PlatformPermission => platformPermissionValues.includes(item as PlatformPermission));
}

export async function requirePlatformPermission(permission?: PlatformPermission) {
  const session = await requireRole(permissions.superAdmin);
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { adminPermissions: true },
  });
  const assigned = parsePlatformPermissions(user?.adminPermissions);

  if (permission && assigned.length > 0 && !assigned.includes(permission)) {
    redirect("/admin?error=permission");
  }

  return session;
}
