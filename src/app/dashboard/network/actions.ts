"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import { NetworkLinkStatus, NetworkOrderStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";
import { audit } from "@/lib/audit";

function networkOrderNumber() {
  return `NX-${Date.now().toString().slice(-8)}-${nanoid(4).toUpperCase()}`;
}

const linkSchema = z.object({
  partnerCode: z.string().min(3).max(32),
});

export async function linkShopByCodeAction(formData: FormData) {
  const session = await requireRole(permissions.network);
  if (!session.shopId) redirect("/login");

  const parsed = linkSchema.safeParse({ partnerCode: formData.get("partnerCode") });
  if (!parsed.success) redirect("/dashboard/network?error=code");

  const partner = await prisma.shop.findUnique({ where: { networkCode: parsed.data.partnerCode.trim().toUpperCase() } });
  if (!partner || partner.id === session.shopId) redirect("/dashboard/network?error=shop");

  const link = await prisma.shopNetworkLink.upsert({
    where: {
      requesterShopId_partnerShopId: {
        requesterShopId: session.shopId,
        partnerShopId: partner.id,
      },
    },
    update: { status: NetworkLinkStatus.ACTIVE },
    create: {
      requesterShopId: session.shopId,
      partnerShopId: partner.id,
      status: NetworkLinkStatus.ACTIVE,
    },
  });

  await audit({
    shopId: session.shopId,
    userId: session.id,
    action: "network.shop_linked",
    entityType: "ShopNetworkLink",
    entityId: link.id,
    metadata: { partnerShopId: partner.id },
  });

  revalidatePath("/dashboard/network");
}

const networkOrderSchema = z.object({
  partnerShopId: z.string().min(1),
  productVariantId: z.string().optional(),
  description: z.string().min(2),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().min(0),
  notes: z.string().optional(),
});

export async function createNetworkOrderAction(formData: FormData) {
  const session = await requireRole(permissions.network);
  if (!session.shopId) redirect("/login");

  const parsed = networkOrderSchema.safeParse({
    partnerShopId: formData.get("partnerShopId"),
    productVariantId: formData.get("productVariantId") || undefined,
    description: formData.get("description"),
    quantity: formData.get("quantity"),
    unitPrice: formData.get("unitPrice"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) redirect("/dashboard/network?error=order");

  const activeLink = await prisma.shopNetworkLink.findFirst({
    where: {
      status: NetworkLinkStatus.ACTIVE,
      OR: [
        { requesterShopId: session.shopId, partnerShopId: parsed.data.partnerShopId },
        { requesterShopId: parsed.data.partnerShopId, partnerShopId: session.shopId },
      ],
    },
  });
  if (!activeLink) redirect("/dashboard/network?error=link");

  const totalAmount = parsed.data.quantity * parsed.data.unitPrice;
  const order = await prisma.shopNetworkOrder.create({
    data: {
      requesterShopId: session.shopId,
      partnerShopId: parsed.data.partnerShopId,
      orderNumber: networkOrderNumber(),
      totalAmount,
      notes: parsed.data.notes,
      items: {
        create: {
          productVariantId: parsed.data.productVariantId,
          description: parsed.data.description,
          quantity: parsed.data.quantity,
          unitPrice: parsed.data.unitPrice,
        },
      },
    },
  });

  await audit({
    shopId: session.shopId,
    userId: session.id,
    action: "network.order_requested",
    entityType: "ShopNetworkOrder",
    entityId: order.id,
    metadata: { partnerShopId: parsed.data.partnerShopId, totalAmount },
  });

  revalidatePath("/dashboard/network");
}

export async function fulfillNetworkOrderAction(formData: FormData) {
  const session = await requireRole(permissions.network);
  const shopId = session.shopId;
  if (!shopId) redirect("/login");

  const orderId = String(formData.get("orderId") ?? "");
  const order = await prisma.shopNetworkOrder.findFirstOrThrow({
    where: { id: orderId, partnerShopId: shopId },
    include: { items: true },
  });
  if (order.status === NetworkOrderStatus.FULFILLED) {
    redirect("/dashboard/network");
  }

  await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      if (item.productVariantId) {
        const variant = await tx.productVariant.findFirst({
          where: { id: item.productVariantId, product: { shopId } },
          include: { product: true },
        });
        if (!variant) {
          throw new Error("Linked stock item was not found for this shop.");
        }
        if (!variant.product.isService && variant.stockQty < item.quantity) {
          throw new Error(`${variant.sku} has only ${variant.stockQty} in stock.`);
        }
        await tx.productVariant.update({
          where: { id: item.productVariantId },
          data: { stockQty: { decrement: item.quantity } },
        });
      }
    }
    await tx.shopNetworkOrder.update({
      where: { id: order.id },
      data: { status: NetworkOrderStatus.FULFILLED },
    });
  });

  await audit({
    shopId,
    userId: session.id,
    action: "network.order_fulfilled",
    entityType: "ShopNetworkOrder",
    entityId: order.id,
  });

  revalidatePath("/dashboard/network");
}
