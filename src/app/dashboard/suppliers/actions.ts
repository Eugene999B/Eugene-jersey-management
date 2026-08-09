"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import {
  ProductionInventoryMovementType,
  Role,
  SupplierAccountEntryType,
  SupplierOrderStatus,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, requireRole } from "@/lib/auth";
import { strongPasswordSchema } from "@/lib/password-policy";
import { permissions } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { requireBusinessModuleAccess } from "@/lib/business-module-access";
import { applyProductionInventoryMovement } from "@/lib/production-inventory";

const supplierSchema = z.object({
  name: z.string().trim().min(2).max(140),
  contactName: z.string().trim().max(120).optional(),
  email: z.string().email().max(180).optional(),
  phone: z.string().trim().max(30).optional(),
  categories: z.string().trim().max(500).optional(),
  paymentTerms: z.string().trim().max(500).optional(),
  leadTimeDays: z.coerce.number().int().min(0).max(365).default(7),
  rating: z.coerce.number().int().min(1).max(5).default(5),
  portalEmail: z.string().email().max(180).optional(),
  portalPassword: strongPasswordSchema.optional(),
}).refine((value) => Boolean(value.portalEmail) === Boolean(value.portalPassword), {
  message: "Portal email and password must be supplied together.",
});

function purchaseOrderNumber() {
  return `PO-${Date.now().toString().slice(-8)}-${nanoid(4).toUpperCase()}`;
}

function goodsReceiptNumber() {
  return `GRN-${Date.now().toString().slice(-8)}-${nanoid(4).toUpperCase()}`;
}

export async function createSupplierAction(formData: FormData) {
  const session = await requireRole(permissions.suppliers);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  const shopId = session.shopId;
  await requireBusinessModuleAccess(shopId, "SUPPLIERS_PURCHASING");
  const parsed = supplierSchema.safeParse({
    name: formData.get("name"), contactName: formData.get("contactName") || undefined,
    email: formData.get("email") || undefined, phone: formData.get("phone") || undefined,
    categories: formData.get("categories") || undefined, paymentTerms: formData.get("paymentTerms") || undefined,
    leadTimeDays: formData.get("leadTimeDays") || 7, rating: formData.get("rating") || 5,
    portalEmail: formData.get("portalEmail") || undefined, portalPassword: formData.get("portalPassword") || undefined,
  });
  if (!parsed.success) redirect("/dashboard/suppliers?error=supplier");

  const portalEmail = parsed.data.portalEmail?.toLowerCase();
  if (portalEmail && await prisma.user.findUnique({ where: { email: portalEmail }, select: { id: true } })) {
    redirect("/dashboard/suppliers?error=portal-email-exists");
  }
  const portalPasswordHash = parsed.data.portalPassword ? await hashPassword(parsed.data.portalPassword) : null;
  const { supplier, portalUser } = await prisma.$transaction(async (tx) => {
    const createdPortalUser = portalEmail && portalPasswordHash
      ? await tx.user.create({ data: { shopId, email: portalEmail, name: parsed.data.contactName ?? parsed.data.name, phone: parsed.data.phone, role: Role.SUPPLIER, passwordHash: portalPasswordHash, isActive: true } })
      : null;
    const createdSupplier = await tx.supplier.create({
      data: { shopId, portalUserId: createdPortalUser?.id, name: parsed.data.name, contactName: parsed.data.contactName, email: parsed.data.email, phone: parsed.data.phone, categories: parsed.data.categories, paymentTerms: parsed.data.paymentTerms, leadTimeDays: parsed.data.leadTimeDays, rating: parsed.data.rating },
    });
    return { supplier: createdSupplier, portalUser: createdPortalUser };
  });
  await audit({ shopId, userId: session.id, action: "supplier.created", entityType: "Supplier", entityId: supplier.id, metadata: { portalUserId: portalUser?.id ?? null } });
  revalidatePath("/dashboard/suppliers");
}

const supplierOrderSchema = z.object({
  supplierId: z.string().min(1).max(100),
  productVariantId: z.string().max(100).optional(),
  productionInventoryItemId: z.string().max(100).optional(),
  description: z.string().trim().min(2).max(500),
  quantity: z.coerce.number().int().positive().max(1_000_000),
  unitCost: z.coerce.number().min(0).max(100_000_000),
  expectedAt: z.coerce.date().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export async function createSupplierOrderAction(formData: FormData) {
  const session = await requireRole(permissions.suppliers);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  const shopId = session.shopId;
  await requireBusinessModuleAccess(shopId, "SUPPLIERS_PURCHASING");
  const parsed = supplierOrderSchema.safeParse({
    supplierId: formData.get("supplierId"), productVariantId: formData.get("productVariantId") || undefined,
    productionInventoryItemId: formData.get("productionInventoryItemId") || undefined,
    description: formData.get("description"), quantity: formData.get("quantity"), unitCost: formData.get("unitCost"),
    expectedAt: formData.get("expectedAt") || undefined, notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) redirect("/dashboard/suppliers?error=order");

  const [supplier, variant, productionItem] = await Promise.all([
    prisma.supplier.findFirst({ where: { id: parsed.data.supplierId, shopId } }),
    parsed.data.productVariantId
      ? prisma.productVariant.findFirst({ where: { id: parsed.data.productVariantId, product: { shopId } }, select: { id: true } })
      : null,
    parsed.data.productionInventoryItemId
      ? prisma.productionInventoryItem.findFirst({ where: { id: parsed.data.productionInventoryItemId, shopId, isActive: true }, select: { id: true } })
      : null,
  ]);
  if (!supplier || (parsed.data.productVariantId && !variant) || (parsed.data.productionInventoryItemId && !productionItem)) redirect("/dashboard/suppliers?error=order-tenant");

  const totalAmount = parsed.data.quantity * parsed.data.unitCost;
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.supplierOrder.create({
      data: {
        shopId, supplierId: supplier.id, createdById: session.id,
        orderNumber: purchaseOrderNumber(), status: SupplierOrderStatus.SENT,
        expectedAt: parsed.data.expectedAt, totalAmount, notes: parsed.data.notes,
        items: { create: { productVariantId: variant?.id, description: parsed.data.description, quantity: parsed.data.quantity, unitCost: parsed.data.unitCost } },
      },
      include: { items: true },
    });
    if (productionItem && created.items[0]) {
      await tx.productionPurchaseLink.create({
        data: { shopId, supplierOrderItemId: created.items[0].id, productionInventoryItemId: productionItem.id },
      });
    }
    return created;
  });
  await audit({ shopId, userId: session.id, action: "supplier.order_created", entityType: "SupplierOrder", entityId: order.id, metadata: { supplierId: supplier.id, totalAmount, productionInventoryItemId: productionItem?.id ?? null } });
  revalidatePath("/dashboard/suppliers");
}

export async function receiveSupplierOrderAction(formData: FormData) {
  const session = await requireRole(permissions.suppliers);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  const shopId = session.shopId;
  await requireBusinessModuleAccess(shopId, "SUPPLIERS_PURCHASING");
  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) redirect("/dashboard/suppliers?error=receive");

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.supplierOrder.findFirst({
        where: { id: orderId, shopId },
        include: { items: true },
      });
      if (!order) throw new Error("ORDER_NOT_FOUND");
      const claimed = await tx.supplierOrder.updateMany({
        where: { id: order.id, shopId, status: { in: [SupplierOrderStatus.SENT, SupplierOrderStatus.ACKNOWLEDGED, SupplierOrderStatus.PARTIALLY_RECEIVED] } },
        data: { status: SupplierOrderStatus.RECEIVED },
      });
      if (claimed.count !== 1) throw new Error("ORDER_ALREADY_RECEIVED");

      const links = await tx.productionPurchaseLink.findMany({ where: { shopId, supplierOrderItemId: { in: order.items.map((item) => item.id) } } });
      const linkMap = new Map(links.map((link) => [link.supplierOrderItemId, link.productionInventoryItemId]));
      let receiptTotal = 0;
      for (const item of order.items) {
        const receiveQuantity = Math.max(0, item.quantity - item.receivedQty);
        if (!receiveQuantity) continue;
        const itemTotal = receiveQuantity * Number(item.unitCost);
        receiptTotal += itemTotal;
        if (item.productVariantId) {
          const variant = await tx.productVariant.findFirst({ where: { id: item.productVariantId, product: { shopId } }, select: { id: true } });
          if (!variant) throw new Error("VARIANT_TENANT_MISMATCH");
          await tx.productVariant.update({ where: { id: variant.id }, data: { stockQty: { increment: receiveQuantity } } });
        }
        const productionInventoryItemId = linkMap.get(item.id) ?? null;
        if (productionInventoryItemId) {
          await applyProductionInventoryMovement(tx, {
            shopId,
            inventoryItemId: productionInventoryItemId,
            type: ProductionInventoryMovementType.PURCHASE_RECEIPT,
            quantity: receiveQuantity,
            unitCostSnapshot: Number(item.unitCost),
            referenceType: "SUPPLIER_ORDER",
            referenceId: order.id,
            note: `${order.orderNumber} goods received from supplier.`,
            idempotencyKey: `supplier-order:${order.id}:item:${item.id}:production-receipt`,
            createdById: session.id,
            updateWeightedCost: true,
          });
        }
        await tx.supplierCostRecord.create({
          data: {
            shopId,
            supplierId: order.supplierId,
            supplierOrderId: order.id,
            supplierOrderItemId: item.id,
            productionInventoryItemId,
            productVariantId: item.productVariantId,
            description: item.description,
            quantity: receiveQuantity,
            unitCost: item.unitCost,
          },
        });
        await tx.supplierOrderItem.update({ where: { id: item.id }, data: { receivedQty: item.quantity } });
      }
      const receipt = await tx.supplierGoodsReceipt.create({
        data: {
          shopId,
          supplierId: order.supplierId,
          supplierOrderId: order.id,
          receiptNumber: goodsReceiptNumber(),
          receivedById: session.id,
          totalAmount: receiptTotal,
          notes: `Full receipt for ${order.orderNumber}.`,
        },
      });
      if (receiptTotal > 0) {
        await tx.supplierAccountEntry.create({
          data: {
            shopId,
            supplierId: order.supplierId,
            type: SupplierAccountEntryType.PURCHASE,
            amount: receiptTotal,
            supplierOrderId: order.id,
            reference: receipt.receiptNumber,
            note: `Goods received for ${order.orderNumber}.`,
            createdById: session.id,
          },
        });
      }
    });
  } catch {
    redirect("/dashboard/suppliers?error=receive-changed");
  }

  await audit({ shopId, userId: session.id, action: "supplier.order_received", entityType: "SupplierOrder", entityId: orderId });
  revalidatePath("/dashboard/suppliers");
  revalidatePath("/dashboard/catalog");
  revalidatePath("/dashboard/production-stock");
}
