"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import { Role, SupplierOrderStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";
import { audit } from "@/lib/audit";

const supplierSchema = z.object({
  name: z.string().min(2),
  contactName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  categories: z.string().optional(),
  paymentTerms: z.string().optional(),
  leadTimeDays: z.coerce.number().int().min(0).max(365).default(7),
  rating: z.coerce.number().int().min(1).max(5).default(5),
  portalEmail: z.string().email().optional(),
  portalPassword: z.string().min(6).optional(),
});

function purchaseOrderNumber() {
  return `PO-${Date.now().toString().slice(-8)}-${nanoid(4).toUpperCase()}`;
}

export async function createSupplierAction(formData: FormData) {
  const session = await requireRole(permissions.suppliers);
  if (!session.shopId) redirect("/login");

  const parsed = supplierSchema.safeParse({
    name: formData.get("name"),
    contactName: formData.get("contactName") || undefined,
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    categories: formData.get("categories") || undefined,
    paymentTerms: formData.get("paymentTerms") || undefined,
    leadTimeDays: formData.get("leadTimeDays") || 7,
    rating: formData.get("rating") || 5,
    portalEmail: formData.get("portalEmail") || undefined,
    portalPassword: formData.get("portalPassword") || undefined,
  });
  if (!parsed.success) redirect("/dashboard/suppliers?error=supplier");

  const portalPasswordHash = parsed.data.portalPassword ? await hashPassword(parsed.data.portalPassword) : null;
  const portalUser = parsed.data.portalEmail && portalPasswordHash
    ? await prisma.user.upsert({
        where: { email: parsed.data.portalEmail.toLowerCase() },
        update: {
          shopId: session.shopId,
          name: parsed.data.contactName ?? parsed.data.name,
          phone: parsed.data.phone,
          role: Role.SUPPLIER,
          passwordHash: portalPasswordHash,
          isActive: true,
        },
        create: {
          shopId: session.shopId,
          email: parsed.data.portalEmail.toLowerCase(),
          name: parsed.data.contactName ?? parsed.data.name,
          phone: parsed.data.phone,
          role: Role.SUPPLIER,
          passwordHash: portalPasswordHash,
          isActive: true,
        },
      })
    : null;

  const supplier = await prisma.supplier.create({
    data: {
      shopId: session.shopId,
      portalUserId: portalUser?.id,
      name: parsed.data.name,
      contactName: parsed.data.contactName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      categories: parsed.data.categories,
      paymentTerms: parsed.data.paymentTerms,
      leadTimeDays: parsed.data.leadTimeDays,
      rating: parsed.data.rating,
    },
  });

  await audit({
    shopId: session.shopId,
    userId: session.id,
    action: "supplier.created",
    entityType: "Supplier",
    entityId: supplier.id,
    metadata: { portalUserId: portalUser?.id ?? null },
  });

  revalidatePath("/dashboard/suppliers");
}

const supplierOrderSchema = z.object({
  supplierId: z.string().min(1),
  productVariantId: z.string().optional(),
  description: z.string().min(2),
  quantity: z.coerce.number().int().positive(),
  unitCost: z.coerce.number().min(0),
  expectedAt: z.coerce.date().optional(),
  notes: z.string().optional(),
});

export async function createSupplierOrderAction(formData: FormData) {
  const session = await requireRole(permissions.suppliers);
  if (!session.shopId) redirect("/login");

  const parsed = supplierOrderSchema.safeParse({
    supplierId: formData.get("supplierId"),
    productVariantId: formData.get("productVariantId") || undefined,
    description: formData.get("description"),
    quantity: formData.get("quantity"),
    unitCost: formData.get("unitCost"),
    expectedAt: formData.get("expectedAt") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) redirect("/dashboard/suppliers?error=order");

  const supplier = await prisma.supplier.findFirstOrThrow({
    where: { id: parsed.data.supplierId, shopId: session.shopId },
  });
  const totalAmount = parsed.data.quantity * parsed.data.unitCost;
  const order = await prisma.supplierOrder.create({
    data: {
      shopId: session.shopId,
      supplierId: supplier.id,
      createdById: session.id,
      orderNumber: purchaseOrderNumber(),
      status: SupplierOrderStatus.SENT,
      expectedAt: parsed.data.expectedAt,
      totalAmount,
      notes: parsed.data.notes,
      items: {
        create: {
          productVariantId: parsed.data.productVariantId,
          description: parsed.data.description,
          quantity: parsed.data.quantity,
          unitCost: parsed.data.unitCost,
        },
      },
    },
  });

  await audit({
    shopId: session.shopId,
    userId: session.id,
    action: "supplier.order_created",
    entityType: "SupplierOrder",
    entityId: order.id,
    metadata: { supplierId: supplier.id, totalAmount },
  });

  revalidatePath("/dashboard/suppliers");
}

export async function receiveSupplierOrderAction(formData: FormData) {
  const session = await requireRole(permissions.suppliers);
  if (!session.shopId) redirect("/login");

  const orderId = String(formData.get("orderId") ?? "");
  const order = await prisma.supplierOrder.findFirstOrThrow({
    where: { id: orderId, shopId: session.shopId },
    include: { items: true },
  });
  if (order.status === SupplierOrderStatus.RECEIVED) {
    redirect("/dashboard/suppliers");
  }

  await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      if (item.productVariantId) {
        await tx.productVariant.update({
          where: { id: item.productVariantId },
          data: { stockQty: { increment: item.quantity } },
        });
      }
      await tx.supplierOrderItem.update({
        where: { id: item.id },
        data: { receivedQty: item.quantity },
      });
    }
    await tx.supplierOrder.update({
      where: { id: order.id },
      data: { status: SupplierOrderStatus.RECEIVED },
    });
  });

  await audit({
    shopId: session.shopId,
    userId: session.id,
    action: "supplier.order_received",
    entityType: "SupplierOrder",
    entityId: order.id,
  });

  revalidatePath("/dashboard/suppliers");
  revalidatePath("/dashboard/catalog");
}
