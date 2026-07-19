import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireActiveShop, requireSession } from "@/lib/auth";
import { permissions, hasRole } from "@/lib/rbac";

export async function getTenantContext() {
  const session = await requireSession();
  const shop = await requireActiveShop(session);

  if (session.role !== Role.SUPER_ADMIN && !session.shopId) {
    redirect("/login?error=missing-shop");
  }

  if (shop && !shop.isActive) {
    return { session, shop, suspended: true };
  }

  return { session, shop, suspended: false };
}

export async function getDashboardMetrics(shopId: string) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const [todaySales, pendingOrders, products, activeStaff, lowStockVariants, recentOrders] = await Promise.all([
    prisma.order.aggregate({
      where: { shopId, createdAt: { gte: start }, status: { not: "CANCELLED" } },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.order.count({ where: { shopId, status: { in: ["PENDING", "IN_PRODUCTION"] } } }),
    prisma.product.count({ where: { shopId } }),
    prisma.user.count({ where: { shopId, isActive: true } }),
    prisma.productVariant.findMany({
      where: { product: { shopId }, stockQty: { lte: 5 } },
      include: { product: true },
      orderBy: { stockQty: "asc" },
      take: 8,
    }),
    prisma.order.findMany({
      where: { shopId },
      include: { customer: true, payments: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  return {
    todaySales,
    pendingOrders,
    products,
    activeStaff,
    lowStockVariants,
    recentOrders,
  };
}

export function assertTenantWrite(role: Role, permission: keyof typeof permissions) {
  if (!hasRole({ role }, permissions[permission])) {
    throw new Error("Permission denied.");
  }
}
