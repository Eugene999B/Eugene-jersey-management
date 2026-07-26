"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Role, SupplierOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function acknowledgeSupplierOrderAction(formData: FormData) {
  const session = await requireRole([Role.SUPPLIER]);
  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) redirect("/supplier?error=order");

  const supplier = await prisma.supplier.findFirst({
    where: { portalUserId: session.id, isActive: true, shop: { isActive: true } },
    select: { id: true, shopId: true },
  });
  if (!supplier) redirect("/supplier?error=inactive");

  const updated = await prisma.supplierOrder.updateMany({
    where: { id: orderId, supplierId: supplier.id, shopId: supplier.shopId, status: SupplierOrderStatus.SENT },
    data: { status: SupplierOrderStatus.ACKNOWLEDGED },
  });
  if (updated.count !== 1) redirect("/supplier?error=changed");

  await audit({
    shopId: supplier.shopId,
    userId: session.id,
    action: "supplier.order_acknowledged",
    entityType: "SupplierOrder",
    entityId: orderId,
  });
  revalidatePath("/supplier");
}
