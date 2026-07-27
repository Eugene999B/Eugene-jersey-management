/**
 * Compatibility alias for unrestricted platform database access.
 *
 * New platform code should import `platformDb` from `@/lib/platform-db`.
 * Tenant-facing routes, pages, and actions must use `createTenantDb()` from
 * `@/lib/tenant-db` so shop scoping cannot be omitted accidentally.
 */
export { platformDb as prisma } from "@/lib/platform-db";
