"use server";

import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import { NotificationChannel, OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { initializePaystackTransaction } from "@/lib/payments";
import { sendCustomerMessage } from "@/lib/messaging";

const orderSchema = z.object({
  shopSlug: z.string().min(1),
  variantId: z.string().min(1),
  quantity: z.coerce.number().int().positive().max(100),
  customerName: z.string().min(2),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email().optional(),
  personalizationName: z.string().optional(),
  personalizationNumber: z.string().optional(),
  notes: z.string().optional(),
  paymentChoice: z.enum(["PAYSTACK", "CASH"]),
});

function receiptNumber(shopSlug: string) {
  return `${shopSlug.split("-").map((part) => part[0]).join("").slice(0, 4).toUpperCase() || "SHOP"}-${Date.now().toString().slice(-7)}`;
}

export async function createPublicOrderAction(formData: FormData) {
  const parsed = orderSchema.safeParse({
    shopSlug: formData.get("shopSlug"),
    variantId: formData.get("variantId"),
    quantity: formData.get("quantity"),
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone") || undefined,
    customerEmail: formData.get("customerEmail") || undefined,
    personalizationName: formData.get("personalizationName") || undefined,
    personalizationNumber: formData.get("personalizationNumber") || undefined,
    notes: formData.get("notes") || undefined,
    paymentChoice: formData.get("paymentChoice"),
  });

  if (!parsed.success) redirect(`/shop/${String(formData.get("shopSlug") ?? "")}?error=invalid`);

  const shop = await prisma.shop.findUnique({
    where: { slug: parsed.data.shopSlug },
    include: { paymentConfig: true },
  });
  if (!shop || !shop.isActive || !shop.storefrontEnabled || !shop.publicOrderingEnabled) {
    redirect(`/shop/${parsed.data.shopSlug}?error=closed`);
  }
  if (parsed.data.paymentChoice === "PAYSTACK" && (!process.env.PAYSTACK_SECRET_KEY || !shop.paymentConfig?.allowCard)) {
    redirect(`/shop/${parsed.data.shopSlug}?error=payment`);
  }

  const variant = await prisma.productVariant.findFirst({
    where: { id: parsed.data.variantId, product: { shopId: shop.id } },
    include: { product: true },
  });
  if (!variant || (!variant.product.isService && variant.stockQty < parsed.data.quantity)) {
    redirect(`/shop/${shop.slug}?error=stock`);
  }

  const customer = await prisma.customer.create({
    data: {
      shopId: shop.id,
      name: parsed.data.customerName,
      phone: parsed.data.customerPhone,
      email: parsed.data.customerEmail,
      group: "Online",
    },
  });

  const unitPrice = Number(variant.priceOverride ?? variant.product.basePrice);
  const totalAmount = unitPrice * parsed.data.quantity;
  const publicAccessToken = nanoid(32);
  const cashHoldExpiresAt = parsed.data.paymentChoice === "CASH"
    ? new Date(Date.now() + shop.cashOrderHoldMinutes * 60_000)
    : null;
  const paystackReference = `SHOP-${shop.slug}-${Date.now()}-${nanoid(6)}`;

  const order = await prisma.$transaction(async (tx) => {
    if (!variant.product.isService) {
      await tx.productVariant.update({
        where: { id: variant.id },
        data: { stockQty: { decrement: parsed.data.quantity } },
      });
    }

    return tx.order.create({
      data: {
        shopId: shop.id,
        customerId: customer.id,
        receiptNumber: receiptNumber(shop.slug),
        status: OrderStatus.PENDING,
        channel: "ONLINE",
        totalAmount,
        notes: parsed.data.notes,
        publicAccessToken,
        cashHoldExpiresAt,
        paystackReference: parsed.data.paymentChoice === "PAYSTACK" ? paystackReference : null,
        items: {
          create: {
            productVariantId: variant.id,
            quantity: parsed.data.quantity,
            unitPrice,
            personalizationData: parsed.data.personalizationName || parsed.data.personalizationNumber
              ? {
                  name: parsed.data.personalizationName ?? "",
                  number: parsed.data.personalizationNumber ?? "",
                  notes: parsed.data.notes ?? "",
                }
              : undefined,
          },
        },
        payments: {
          create: {
            method: parsed.data.paymentChoice === "PAYSTACK" ? PaymentMethod.CARD : PaymentMethod.CASH,
            amount: totalAmount,
            status: PaymentStatus.PENDING,
            providerReference: parsed.data.paymentChoice === "PAYSTACK" ? paystackReference : "CASH-ON-PICKUP",
          },
        },
      },
    });
  });

  await audit({
    shopId: shop.id,
    action: "public.order_created",
    entityType: "Order",
    entityId: order.id,
    metadata: { paymentChoice: parsed.data.paymentChoice, receiptNumber: order.receiptNumber },
  });

  if (customer.phone || customer.email) {
    const body = `${shop.name}: order ${order.receiptNumber} received. Track it here: ${(process.env.APP_URL ?? "").replace(/\/$/, "")}/track/${order.receiptNumber}`;
    await Promise.all([
      customer.phone ? sendCustomerMessage({
        shopId: shop.id,
        customerId: customer.id,
        channel: NotificationChannel.SMS,
        recipientName: customer.name,
        recipientPhone: customer.phone,
        recipientEmail: customer.email,
        subject: `Order ${order.receiptNumber}`,
        body,
        metadata: { orderId: order.id, receiptNumber: order.receiptNumber },
      }) : null,
      customer.phone ? sendCustomerMessage({
        shopId: shop.id,
        customerId: customer.id,
        channel: NotificationChannel.WHATSAPP,
        recipientName: customer.name,
        recipientPhone: customer.phone,
        recipientEmail: customer.email,
        subject: `Order ${order.receiptNumber}`,
        body,
        metadata: { orderId: order.id, receiptNumber: order.receiptNumber },
      }) : null,
      !customer.phone && customer.email ? sendCustomerMessage({
        shopId: shop.id,
        customerId: customer.id,
        channel: NotificationChannel.EMAIL,
        recipientName: customer.name,
        recipientEmail: customer.email,
        subject: `Order ${order.receiptNumber}`,
        body,
        metadata: { orderId: order.id, receiptNumber: order.receiptNumber },
      }) : null,
    ]);
  }

  if (parsed.data.paymentChoice === "PAYSTACK") {
    const callbackUrl = `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/track/${order.receiptNumber}`;
    const initialized = await initializePaystackTransaction({
      email: customer.email ?? `${customer.id}@customer.local`,
      amount: totalAmount,
      currency: shop.currency,
      reference: paystackReference,
      callbackUrl,
      metadata: { orderId: order.id, shopId: shop.id, receiptNumber: order.receiptNumber },
    });
    if (initialized.authorizationUrl) redirect(initialized.authorizationUrl);
  }

  redirect(`/track/${order.receiptNumber}`);
}
