import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { NotificationChannel, PaymentMethod, PaymentStatus, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { sendCustomerMessage } from "@/lib/messaging";

const checkoutSchema = z.object({
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email().optional(),
  paymentMethod: z.nativeEnum(PaymentMethod),
  discountAmount: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
  items: z.array(z.object({
    variantId: z.string().min(1),
    quantity: z.number().int().positive(),
    personalizationData: z.record(z.string(), z.string()).optional(),
  })).min(1),
});

function receiptNumber(shopSlug: string) {
  const prefix = shopSlug
    .split("-")
    .map((part) => part[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();
  return `${prefix || "SHOP"}-${Date.now().toString().slice(-7)}`;
}

export async function POST(request: NextRequest) {
  const session = await requireRole(permissions.pos);
  if (!session.shopId) {
    return NextResponse.json({ error: "Missing shop context." }, { status: 403 });
  }

  const parsed = checkoutSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid checkout payload." }, { status: 400 });
  }

  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: session.shopId } });
  const variantIds = parsed.data.items.map((item) => item.variantId);
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds }, product: { shopId: session.shopId } },
    include: { product: true },
  });

  if (variants.length !== variantIds.length) {
    return NextResponse.json({ error: "One or more products are unavailable." }, { status: 404 });
  }

  const variantById = new Map(variants.map((variant) => [variant.id, variant]));
  let subtotal = 0;

  for (const item of parsed.data.items) {
    const variant = variantById.get(item.variantId);
    if (!variant) continue;
    if (!variant.product.isService && variant.stockQty < item.quantity) {
      return NextResponse.json({ error: `${variant.sku} has only ${variant.stockQty} in stock.` }, { status: 409 });
    }
    subtotal += Number(variant.priceOverride ?? variant.product.basePrice) * item.quantity;
  }

  const discountAmount = Math.min(parsed.data.discountAmount, subtotal);
  const totalAmount = Math.max(subtotal - discountAmount, 0);
  const customer = parsed.data.customerName
    ? await prisma.customer.create({
        data: {
          shopId: session.shopId,
          name: parsed.data.customerName,
          phone: parsed.data.customerPhone,
          email: parsed.data.customerEmail,
        },
      })
    : null;

  const order = await prisma.$transaction(async (tx) => {
    for (const item of parsed.data.items) {
      const variant = variantById.get(item.variantId);
      if (variant && !variant.product.isService) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stockQty: { decrement: item.quantity } },
        });
      }
    }

    return tx.order.create({
      data: {
        shopId: session.shopId!,
        customerId: customer?.id,
        processedById: session.id,
        receiptNumber: receiptNumber(shop.slug),
        status: OrderStatus.COMPLETED,
        channel: "POS",
        totalAmount,
        discountAmount,
        notes: parsed.data.notes,
        items: {
          create: parsed.data.items.map((item) => {
            const variant = variantById.get(item.variantId)!;
            return {
              productVariantId: item.variantId,
              quantity: item.quantity,
              unitPrice: Number(variant.priceOverride ?? variant.product.basePrice),
              personalizationData: item.personalizationData ?? undefined,
            };
          }),
        },
        payments: {
          create: {
            method: parsed.data.paymentMethod,
            amount: totalAmount,
            status: PaymentStatus.SUCCESS,
            providerReference:
              parsed.data.paymentMethod === PaymentMethod.CASH
                ? "CASH-RECORDED"
                : `SANDBOX-${parsed.data.paymentMethod}-${Date.now()}`,
          },
        },
      },
    });
  });

  await audit({
    shopId: session.shopId,
    userId: session.id,
    action: "pos.checkout_completed",
    entityType: "Order",
    entityId: order.id,
    metadata: { receiptNumber: order.receiptNumber, paymentMethod: parsed.data.paymentMethod },
  });

  if (customer?.phone || customer?.email) {
    const receiptBody = `${shop.name}: receipt ${order.receiptNumber} total ${totalAmount.toFixed(2)} ${shop.currency}. Track: ${(process.env.APP_URL ?? "").replace(/\/$/, "")}/track/${order.receiptNumber}`;
    await Promise.all([
      customer.phone ? sendCustomerMessage({
        shopId: session.shopId,
        customerId: customer.id,
        channel: NotificationChannel.SMS,
        recipientName: customer.name,
        recipientPhone: customer.phone,
        recipientEmail: customer.email,
        subject: `Receipt ${order.receiptNumber}`,
        body: receiptBody,
        metadata: { orderId: order.id, receiptNumber: order.receiptNumber },
      }) : null,
      customer.phone ? sendCustomerMessage({
        shopId: session.shopId,
        customerId: customer.id,
        channel: NotificationChannel.WHATSAPP,
        recipientName: customer.name,
        recipientPhone: customer.phone,
        recipientEmail: customer.email,
        subject: `Receipt ${order.receiptNumber}`,
        body: receiptBody,
        metadata: { orderId: order.id, receiptNumber: order.receiptNumber },
      }) : null,
      !customer.phone && customer.email ? sendCustomerMessage({
        shopId: session.shopId,
        customerId: customer.id,
        channel: NotificationChannel.EMAIL,
        recipientName: customer.name,
        recipientEmail: customer.email,
        subject: `Receipt ${order.receiptNumber}`,
        body: receiptBody,
        metadata: { orderId: order.id, receiptNumber: order.receiptNumber },
      }) : null,
    ]);
  }

  return NextResponse.json({
    orderId: order.id,
    receiptNumber: order.receiptNumber,
    totalAmount,
  });
}
