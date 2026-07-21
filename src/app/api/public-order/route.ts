import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { DeliveryStatus, FulfillmentType, NotificationChannel, OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { initializePaystackTransaction } from "@/lib/payments";
import { sendCustomerMessage } from "@/lib/messaging";
import { getBuyerSession } from "@/lib/buyer-session";
import { createNumericCode } from "@/lib/phone-codes";
import { hashToken } from "@/lib/tokens";

const orderSchema = z.object({
  shopSlug: z.string().min(1),
  variantId: z.string().min(1),
  quantity: z.coerce.number().int().positive().max(100),
  personalizationName: z.string().optional(),
  personalizationNumber: z.string().optional(),
  notes: z.string().optional(),
  fulfillmentType: z.nativeEnum(FulfillmentType).default(FulfillmentType.PICKUP),
  deliveryAddress: z.string().optional(),
  deliveryCity: z.string().optional(),
  deliveryArea: z.string().optional(),
  deliveryNotes: z.string().optional(),
  paymentChoice: z.enum(["PAYSTACK", "CASH"]),
});

function receiptNumber(shopSlug: string) {
  return `${shopSlug.split("-").map((part) => part[0]).join("").slice(0, 4).toUpperCase() || "SHOP"}-${Date.now().toString().slice(-7)}`;
}

function redirectTo(path: string) {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const shopSlug = String(formData.get("shopSlug") ?? "");
  const parsed = orderSchema.safeParse({
    shopSlug,
    variantId: formData.get("variantId"),
    quantity: formData.get("quantity"),
    personalizationName: formData.get("personalizationName") || undefined,
    personalizationNumber: formData.get("personalizationNumber") || undefined,
    notes: formData.get("notes") || undefined,
    fulfillmentType: formData.get("fulfillmentType") || FulfillmentType.PICKUP,
    deliveryAddress: formData.get("deliveryAddress") || undefined,
    deliveryCity: formData.get("deliveryCity") || undefined,
    deliveryArea: formData.get("deliveryArea") || undefined,
    deliveryNotes: formData.get("deliveryNotes") || undefined,
    paymentChoice: formData.get("paymentChoice"),
  });

  if (!parsed.success) return redirectTo(`/shop/${shopSlug}?error=invalid`);
  if (parsed.data.fulfillmentType === FulfillmentType.DELIVERY && !parsed.data.deliveryAddress) {
    return redirectTo(`/shop/${shopSlug}?error=delivery`);
  }

  const buyerSession = await getBuyerSession();
  if (!buyerSession) {
    return redirectTo(`/buyer/login?next=${encodeURIComponent(`/shop/${parsed.data.shopSlug}`)}&error=login-required`);
  }

  const buyer = await prisma.buyerAccount.findUnique({ where: { id: buyerSession.id } });
  if (!buyer || !buyer.isActive || buyer.phone !== buyerSession.phone) {
    return redirectTo(`/buyer/login?next=${encodeURIComponent(`/shop/${parsed.data.shopSlug}`)}&error=login-required`);
  }

  const shop = await prisma.shop.findUnique({
    where: { slug: parsed.data.shopSlug },
    include: { paymentConfig: true },
  });
  if (!shop || !shop.isActive || !shop.storefrontEnabled || !shop.publicOrderingEnabled) {
    return redirectTo(`/shop/${parsed.data.shopSlug}?error=closed`);
  }
  if (parsed.data.paymentChoice === "PAYSTACK" && (!process.env.PAYSTACK_SECRET_KEY || !shop.paymentConfig?.allowCard)) {
    return redirectTo(`/shop/${parsed.data.shopSlug}?error=payment`);
  }

  const variant = await prisma.productVariant.findFirst({
    where: { id: parsed.data.variantId, product: { shopId: shop.id } },
    include: { product: true },
  });
  if (!variant || (!variant.product.isService && variant.stockQty < parsed.data.quantity)) {
    return redirectTo(`/shop/${shop.slug}?error=stock`);
  }

  const unitPrice = Number(variant.priceOverride ?? variant.product.basePrice);
  const deliveryFee = parsed.data.fulfillmentType === FulfillmentType.DELIVERY ? 0 : 0;
  const totalAmount = unitPrice * parsed.data.quantity + deliveryFee;
  const publicAccessToken = nanoid(32);
  const cashHoldExpiresAt = parsed.data.paymentChoice === "CASH"
    ? new Date(Date.now() + shop.cashOrderHoldMinutes * 60_000)
    : null;
  const paystackReference = `SHOP-${shop.slug}-${Date.now()}-${nanoid(6)}`;
  const verificationCode = createNumericCode();

  let orderResult;
  try {
    orderResult = await prisma.$transaction(async (tx) => {
    if (!variant.product.isService) {
      const updated = await tx.productVariant.updateMany({
        where: { id: variant.id, stockQty: { gte: parsed.data.quantity } },
        data: { stockQty: { decrement: parsed.data.quantity } },
      });
      if (updated.count !== 1) throw new Error("INSUFFICIENT_STOCK");
    }

    const customer = await tx.customer.create({
      data: {
        shopId: shop.id,
        name: buyer.name,
        phone: buyer.phone,
        email: buyer.email,
        group: "Online",
      },
    });

    const order = await tx.order.create({
      data: {
        shopId: shop.id,
        customerId: customer.id,
        receiptNumber: receiptNumber(shop.slug),
        status: OrderStatus.PENDING,
        channel: "ONLINE",
        totalAmount,
        buyerId: buyer.id,
        notes: parsed.data.notes,
        publicAccessToken,
        cashHoldExpiresAt,
        paystackReference: parsed.data.paymentChoice === "PAYSTACK" ? paystackReference : null,
        fulfillmentType: parsed.data.fulfillmentType,
        deliveryStatus: parsed.data.fulfillmentType === FulfillmentType.DELIVERY ? DeliveryStatus.REQUESTED : DeliveryStatus.NOT_REQUIRED,
        deliveryAddress: parsed.data.fulfillmentType === FulfillmentType.DELIVERY ? parsed.data.deliveryAddress : null,
        deliveryCity: parsed.data.fulfillmentType === FulfillmentType.DELIVERY ? parsed.data.deliveryCity : null,
        deliveryArea: parsed.data.fulfillmentType === FulfillmentType.DELIVERY ? parsed.data.deliveryArea : null,
        deliveryNotes: parsed.data.fulfillmentType === FulfillmentType.DELIVERY ? parsed.data.deliveryNotes : null,
        deliveryFee,
        pickupCodeHash: hashToken(verificationCode),
        pickupCodeLast4: verificationCode.slice(-4),
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
            providerReference: parsed.data.paymentChoice === "PAYSTACK" ? paystackReference : "CASH-RESERVATION",
          },
        },
      },
    });
    return { order, customer };
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      return redirectTo(`/shop/${shop.slug}?error=stock`);
    }
    throw error;
  }

  const { order, customer } = orderResult;

  await audit({
    shopId: shop.id,
    action: "public.order_created",
    entityType: "Order",
    entityId: order.id,
    metadata: {
      paymentChoice: parsed.data.paymentChoice,
      fulfillmentType: parsed.data.fulfillmentType,
      receiptNumber: order.receiptNumber,
    },
  });

  if (customer.phone || customer.email) {
    const verifyCopy = parsed.data.fulfillmentType === FulfillmentType.PICKUP
      ? `Pickup code: ${verificationCode}. Bring this code and your phone number when collecting.`
      : `Delivery verification code: ${verificationCode}. Share it only after receiving the order.`;
    const body = `${shop.name}: order ${order.receiptNumber} received. ${verifyCopy} Track: ${(process.env.APP_URL ?? "").replace(/\/$/, "")}/track/${order.receiptNumber}`;
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
      subaccount: shop.paymentConfig?.paystackSubaccountCode,
      transactionCharge: shop.paymentConfig?.paystackTransactionCharge,
      bearer: shop.paymentConfig?.paystackChargeBearer as "account" | "subaccount" | "all-proportional" | "all" | null,
      metadata: { orderId: order.id, shopId: shop.id, receiptNumber: order.receiptNumber },
    });
    if (initialized.authorizationUrl) return redirectTo(initialized.authorizationUrl);
  }

  return redirectTo(`/track/${order.receiptNumber}`);
}
