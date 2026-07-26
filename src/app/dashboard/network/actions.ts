"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import { NetworkLinkStatus, NetworkOrderStatus, ShopVerificationStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";
import { audit } from "@/lib/audit";

function networkOrderNumber() {
  return `NX-${Date.now().toString().slice(-8)}-${nanoid(4).toUpperCase()}`;
}

const linkSchema = z.object({ partnerCode: z.string().trim().min(3).max(32) });

export async function linkShopByCodeAction(formData: FormData) {
  const session = await requireRole(permissions.network);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  const parsed = linkSchema.safeParse({ partnerCode: formData.get("partnerCode") });
  if (!parsed.success) redirect("/dashboard/network?error=code");

  const partner = await prisma.shop.findUnique({ where: { networkCode: parsed.data.partnerCode.toUpperCase() } });
  if (!partner || partner.id === session.shopId || !partner.isActive || partner.verificationStatus !== ShopVerificationStatus.VERIFIED) {
    redirect("/dashboard/network?error=shop");
  }

  const link = await prisma.shopNetworkLink.upsert({
    where: { requesterShopId_partnerShopId: { requesterShopId: session.shopId, partnerShopId: partner.id } },
    update: { status: NetworkLinkStatus.ACTIVE },
    create: { requesterShopId: session.shopId, partnerShopId: partner.id, status: NetworkLinkStatus.ACTIVE },
  });
  await audit({ shopId: session.shopId, userId: session.id, action: "network.shop_linked", entityType: "ShopNetworkLink", entityId: link.id, metadata: { partnerShopId: partner.id } });
  revalidatePath("/dashboard/network");
}

const networkOrderSchema = z.object({
  partnerShopId: z.string().min(1).max(100),
  productVariantId: z.string().max(100).optional(),
  description: z.string().trim().min(2).max(500),
  quantity: z.coerce.number().int().positive().max(1_000_000),
  unitPrice: z.coerce.number().min(0).max(100_000_000),
  notes: z.string().trim().max(1000).optional(),
});

export async function createNetworkOrderAction(formData: FormData) {
  const session = await requireRole(permissions.network);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  const parsed = networkOrderSchema.safeParse({
    partnerShopId: formData.get("partnerShopId"), productVariantId: formData.get("productVariantId") || undefined,
    description: formData.get("description"), quantity: formData.get("quantity"), unitPrice: formData.get("unitPrice"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) redirect("/dashboard/network?error=order");

  const [activeLink, partner, variant] = await Promise.all([
    prisma.shopNetworkLink.findFirst({
      where: { status: NetworkLinkStatus.ACTIVE, OR: [{ requesterShopId: session.shopId, partnerShopId: parsed.data.partnerShopId }, { requesterShopId: parsed.data.partnerShopId, partnerShopId: session.shopId }] },
    }),
    prisma.shop.findFirst({ where: { id: parsed.data.partnerShopId, isActive: true, verificationStatus: ShopVerificationStatus.VERIFIED }, select: { id: true } }),
    parsed.data.productVariantId
      ? prisma.productVariant.findFirst({ where: { id: parsed.data.productVariantId, product: { shopId: parsed.data.partnerShopId } }, select: { id: true } })
      : null,
  ]);
  if (!activeLink || !partner || (parsed.data.productVariantId && !variant)) redirect("/dashboard/network?error=link");

  const totalAmount = parsed.data.quantity * parsed.data.unitPrice;
  const order = await prisma.shopNetworkOrder.create({
    data: {
      requesterShopId: session.shopId, partnerShopId: partner.id, orderNumber: networkOrderNumber(), totalAmount,
      notes: parsed.data.notes,
      items: { create: { productVariantId: variant?.id, description: parsed.data.description, quantity: parsed.data.quantity, unitPrice: parsed.data.unitPrice } },
    },
  });
  await audit({ shopId: session.shopId, userId: session.id, action: "network.order_requested", entityType: "ShopNetworkOrder", entityId: order.id, metadata: { partnerShopId: partner.id, totalAmount } });
  revalidatePath("/dashboard/network");
}

export async function fulfillNetworkOrderAction(formData: FormData) {
  const session = await requireRole(permissions.network);
  const shopId = session.shopId;
  if (!shopId) redirect("/login");
  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) redirect("/dashboard/network?error=fulfill");

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.shopNetworkOrder.findFirst({ where: { id: orderId, partnerShopId: shopId }, include: { items: true } });
      if (!order) throw new Error("ORDER_NOT_FOUND");
      const claimed = await tx.shopNetworkOrder.updateMany({
        where: { id: order.id, partnerShopId: shopId, status: { in: [NetworkOrderStatus.REQUESTED, NetworkOrderStatus.ACCEPTED] } },
        data: { status: NetworkOrderStatus.FULFILLED },
      });
      if (claimed.count !== 1) throw new Error("ORDER_CHANGED");

      for (const item of order.items) {
        if (!item.productVariantId) continue;
        const variant = await tx.productVariant.findFirst({ where: { id: item.productVariantId, product: { shopId } }, include: { product: true } });
        if (!variant) throw new Error("VARIANT_TENANT_MISMATCH");
        if (!variant.product.isService) {
          const stock = await tx.productVariant.updateMany({
            where: { id: variant.id, stockQty: { gte: item.quantity } },
            data: { stockQty: { decrement: item.quantity } },
          });
          if (stock.count !== 1) throw new Error("INSUFFICIENT_STOCK");
        }
      }
    });
  } catch {
    redirect("/dashboard/network?error=fulfill-changed");
  }

  await audit({ shopId, userId: session.id, action: "network.order_fulfilled", entityType: "ShopNetworkOrder", entityId: orderId });
  revalidatePath("/dashboard/network");
}
