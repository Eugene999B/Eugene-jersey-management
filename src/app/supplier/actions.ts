"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SupplierOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function acknowledgeSupplierOrderAction(formData: FormData) {
  const session = await requireSession();
  if (session.role !== "SUPPLIER") redirect("/login");

  const orderId = String(formData.get("orderId") ?? "");
  const supplier = await prisma.supplier.findUniqueOrThrow({ where: { portalUserId: session.id } });
  const order = await prisma.supplierOrder.findFirstOrThrow({
    where: { id: orderId, supplierId: supplier.id },
  });

  await prisma.supplierOrder.update({
    where: { id: order.id },
    data: { status: SupplierOrderStatus.ACKNOWLEDGED },
  });

  await audit({
    shopId: supplier.shopId,
    userId: session.id,
    action: "supplier.order_acknowledged",
    entityType: "SupplierOrder",
    entityId: order.id,
  });

  revalidatePath("/supplier");
}
