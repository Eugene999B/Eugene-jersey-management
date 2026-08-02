import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { DeliveryStatus, FulfillmentType, NotificationChannel, OrderChannel, OrderStatus, PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { initializePaystackTransaction, isPaystackCheckoutReady } from "@/lib/payments";
import { sendDirectMessage } from "@/lib/messaging";
import { getBuyerSession } from "@/lib/buyer-session";
import { createNumericCode } from "@/lib/phone-codes";
import { hashToken } from "@/lib/tokens";
import { enforceRateLimit } from "@/lib/rate-limit";
import { releaseUnpaidOnlineReservation } from "@/lib/order-lifecycle";
import { assertOrderCreationAvailable, commercialSubscriptionError } from "@/lib/subscription-hardening";

const orderSchema = z.object({
  shopSlug: z.string().trim().min(1).max(120),
  variantId: z.string().min(1).max(100),
  quantity: z.coerce.number().int().positive().max(100),
  personalizationName: z.string().trim().max(80).optional(),
  personalizationNumber: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(1000).optional(),
  fulfillmentType: z.nativeEnum(FulfillmentType).default(FulfillmentType.PICKUP),
  deliveryAddress: z.string().trim().max(500).optional(),
  deliveryZoneId: z.string().max(100).optional(),
  deliveryCity: z.string().trim().max(100).optional(),
  deliveryArea: z.string().trim().max(150).optional(),
  deliveryNotes: z.string().trim().max(500).optional(),
  paymentChoice: z.enum(["PAYSTACK", "CASH"]),
  idempotencyKey: z.string().min(8).max(100),
});

function receiptNumber(shopSlug: string) {
  return `${shopSlug.split("-").map((part) => part[0]).join("").slice(0, 4).toUpperCase() || "SHOP"}-${Date.now().toString().slice(-7)}-${nanoid(4).toUpperCase()}`;
}

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url), 303);
}

function applicationOrigin(request: NextRequest) {
  const configured = process.env.APP_URL?.trim();
  if (!configured) return request.nextUrl.origin;
  try {
    return new URL(configured).origin;
  } catch {
    return request.nextUrl.origin;
  }
}

function requestIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const shopSlug = String(formData.get("shopSlug") ?? "");
  const parsed = orderSchema.safeParse({
    shopSlug,
    variantId: formData.get("variantId"), quantity: formData.get("quantity"),
    personalizationName: formData.get("personalizationName") || undefined,
    personalizationNumber: formData.get("personalizationNumber") || undefined,
    notes: formData.get("notes") || undefined,
    fulfillmentType: formData.get("fulfillmentType") || FulfillmentType.PICKUP,
    deliveryAddress: formData.get("deliveryAddress") || undefined,
    deliveryZoneId: formData.get("deliveryZoneId") || undefined,
    deliveryCity: formData.get("deliveryCity") || undefined,
    deliveryArea: formData.get("deliveryArea") || undefined,
    deliveryNotes: formData.get("deliveryNotes") || undefined,
    paymentChoice: formData.get("paymentChoice"), idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) return redirectTo(request, `/shop/${encodeURIComponent(shopSlug)}?error=invalid`);
  if (parsed.data.fulfillmentType === FulfillmentType.DELIVERY && !parsed.data.deliveryAddress) return redirectTo(request, `/shop/${parsed.data.shopSlug}?error=delivery`);

  const buyerSession = await getBuyerSession();
  if (!buyerSession) return redirectTo(request, `/buyer/login?next=${encodeURIComponent(`/shop/${parsed.data.shopSlug}`)}&error=login-required`);

  try {
    await Promise.all([
      enforceRateLimit({ key: `public-order-buyer:${buyerSession.id}`, limit: 15, windowSeconds: 60 * 60 }),
      enforceRateLimit({ key: `public-order-ip:${requestIp(request)}`, limit: 40, windowSeconds: 60 * 60 }),
    ]);
  } catch {
    return redirectTo(request, `/shop/${parsed.data.shopSlug}?error=rate`);
  }

  const buyer = await prisma.buyerAccount.findUnique({ where: { id: buyerSession.id } });
  if (!buyer || !buyer.isActive || buyer.phone !== buyerSession.phone) {
    return redirectTo(request, `/buyer/login?next=${encodeURIComponent(`/shop/${parsed.data.shopSlug}`)}&error=login-required`);
  }

  const shop = await prisma.shop.findUnique({ where: { slug: parsed.data.shopSlug }, include: { paymentConfig: true } });
  if (!shop || !shop.isActive || !shop.storefrontEnabled || !shop.publicOrderingEnabled || !shop.enabledModules.includes("ONLINE_SELLING")) return redirectTo(request, `/shop/${parsed.data.shopSlug}?error=closed`);
  if (parsed.data.fulfillmentType === FulfillmentType.DELIVERY && parsed.data.paymentChoice === "CASH") return redirectTo(request, `/shop/${shopSlug}?error=delivery-payment`);
  if (parsed.data.paymentChoice === "PAYSTACK" && !isPaystackCheckoutReady(shop.paymentConfig)) return redirectTo(request, `/shop/${parsed.data.shopSlug}?error=payment`);
  if (parsed.data.paymentChoice === "CASH" && !shop.paymentConfig?.allowCash) return redirectTo(request, `/shop/${parsed.data.shopSlug}?error=payment`);

  const duplicateOrder = await prisma.order.findUnique({ where: { idempotencyKey: parsed.data.idempotencyKey } });
  if (duplicateOrder) {
    if (duplicateOrder.buyerId === buyer.id) return redirectTo(request, `/track/${duplicateOrder.receiptNumber}?access=${encodeURIComponent(duplicateOrder.publicAccessToken)}`);
    return redirectTo(request, `/shop/${shop.slug}?error=duplicate-request`);
  }

  try {
    await assertOrderCreationAvailable({ shopId: shop.id, channel: OrderChannel.ONLINE });
  } catch (error) {
    if (commercialSubscriptionError(error)) return redirectTo(request, `/shop/${shop.slug}?error=subscription`);
    throw error;
  }

  const variant = await prisma.productVariant.findFirst({ where: { id: parsed.data.variantId, product: { shopId: shop.id } }, include: { product: true } });
  if (!variant || (!variant.product.isService && variant.stockQty < parsed.data.quantity)) return redirectTo(request, `/shop/${shop.slug}?error=stock`);

  const deliveryZone = parsed.data.fulfillmentType === FulfillmentType.DELIVERY && parsed.data.deliveryZoneId
    ? await prisma.deliveryZone.findFirst({ where: { id: parsed.data.deliveryZoneId, shopId: shop.id, isActive: true } })
    : null;
  if (parsed.data.fulfillmentType === FulfillmentType.DELIVERY && !deliveryZone) return redirectTo(request, `/shop/${shop.slug}?error=delivery`);

  const unitPrice = Number(variant.priceOverride ?? variant.product.basePrice);
  const deliveryFee = parsed.data.fulfillmentType === FulfillmentType.DELIVERY ? Number(deliveryZone?.fee ?? 0) : 0;
  const totalAmount = unitPrice * parsed.data.quantity + deliveryFee;
  const publicAccessToken = nanoid(32);
  const cashHoldExpiresAt = parsed.data.paymentChoice === "CASH" ? new Date(Date.now() + shop.cashOrderHoldMinutes * 60_000) : null;
  const paystackReference = `SHOP-${shop.slug}-${Date.now()}-${nanoid(6)}`;
  const verificationCode = createNumericCode();

  let orderResult;
  try {
    orderResult = await prisma.$transaction(async (tx) => {
      if (!variant.product.isService) {
        const updated = await tx.productVariant.updateMany({ where: { id: variant.id, stockQty: { gte: parsed.data.quantity } }, data: { stockQty: { decrement: parsed.data.quantity } } });
        if (updated.count !== 1) throw new Error("INSUFFICIENT_STOCK");
      }
      const matchedCustomer = await tx.customer.findFirst({ where: { shopId: shop.id, OR: [{ phone: buyer.phone }, ...(buyer.email ? [{ email: buyer.email }] : [])] } });
      const customer = matchedCustomer
        ? await tx.customer.update({ where: { id: matchedCustomer.id }, data: { name: buyer.name, phone: buyer.phone, email: buyer.email } })
        : await tx.customer.create({ data: { shopId: shop.id, name: buyer.name, phone: buyer.phone, email: buyer.email, group: "Online" } });
      const order = await tx.order.create({
        data: {
          shopId: shop.id, customerId: customer.id, receiptNumber: receiptNumber(shop.slug), status: OrderStatus.PENDING,
          channel: OrderChannel.ONLINE, totalAmount, buyerId: buyer.id, notes: parsed.data.notes, publicAccessToken,
          idempotencyKey: parsed.data.idempotencyKey, cashHoldExpiresAt,
          paystackReference: parsed.data.paymentChoice === "PAYSTACK" ? paystackReference : null,
          fulfillmentType: parsed.data.fulfillmentType,
          deliveryStatus: parsed.data.fulfillmentType === FulfillmentType.DELIVERY ? DeliveryStatus.REQUESTED : DeliveryStatus.NOT_REQUIRED,
          deliveryAddress: parsed.data.fulfillmentType === FulfillmentType.DELIVERY ? parsed.data.deliveryAddress : null,
          deliveryCity: parsed.data.fulfillmentType === FulfillmentType.DELIVERY ? parsed.data.deliveryCity : null,
          deliveryArea: parsed.data.fulfillmentType === FulfillmentType.DELIVERY ? parsed.data.deliveryArea : null,
          deliveryNotes: parsed.data.fulfillmentType === FulfillmentType.DELIVERY ? parsed.data.deliveryNotes : null,
          deliveryFee, deliveryZoneId: deliveryZone?.id ?? null,
          pickupCodeHash: hashToken(verificationCode), pickupCodeLast4: verificationCode.slice(-4),
          items: { create: { productVariantId: variant.id, quantity: parsed.data.quantity, unitPrice, personalizationData: parsed.data.personalizationName || parsed.data.personalizationNumber ? { name: parsed.data.personalizationName ?? "", number: parsed.data.personalizationNumber ?? "", notes: parsed.data.notes ?? "" } : undefined } },
          payments: { create: { method: parsed.data.paymentChoice === "PAYSTACK" ? PaymentMethod.CARD : PaymentMethod.CASH, amount: totalAmount, status: PaymentStatus.PENDING, providerReference: parsed.data.paymentChoice === "PAYSTACK" ? paystackReference : "CASH-RESERVATION" } },
        },
      });
      return { order, customer };
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") return redirectTo(request, `/shop/${shop.slug}?error=stock`);
    if (commercialSubscriptionError(error)) return redirectTo(request, `/shop/${shop.slug}?error=subscription`);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.order.findUnique({ where: { idempotencyKey: parsed.data.idempotencyKey } });
      if (existing?.buyerId === buyer.id) return redirectTo(request, `/track/${existing.receiptNumber}?access=${encodeURIComponent(existing.publicAccessToken)}`);
      return redirectTo(request, `/shop/${shop.slug}?error=duplicate-request`);
    }
    throw error;
  }

  const { order, customer } = orderResult;
  const appOrigin = applicationOrigin(request);
  let paymentRedirect: string | null = null;
  if (parsed.data.paymentChoice === "PAYSTACK") {
    try {
      const initialized = await initializePaystackTransaction({
        email: customer.email ?? `${customer.id}@customer.local`, amount: totalAmount, currency: shop.currency,
        reference: paystackReference, callbackUrl: new URL("/api/paystack/callback", appOrigin).toString(),
        subaccount: shop.paymentConfig?.paystackSubaccountCode,
        transactionCharge: shop.paymentConfig?.paystackTransactionCharge,
        bearer: shop.paymentConfig?.paystackChargeBearer as "account" | "subaccount" | "all-proportional" | "all" | null,
        metadata: { orderId: order.id, shopId: shop.id, receiptNumber: order.receiptNumber },
      });
      paymentRedirect = initialized.authorizationUrl;
      if (!paymentRedirect) throw new Error("PAYSTACK_URL_MISSING");
    } catch {
      await releaseUnpaidOnlineReservation({ orderId: order.id, reason: "Paystack checkout could not be initialised." });
      return redirectTo(request, `/shop/${shop.slug}?error=payment-init`);
    }
  }

  await audit({ shopId: shop.id, action: "public.order_created", entityType: "Order", entityId: order.id, metadata: { paymentChoice: parsed.data.paymentChoice, fulfillmentType: parsed.data.fulfillmentType, receiptNumber: order.receiptNumber } });

  const trackUrl = new URL(`/track/${order.receiptNumber}?access=${encodeURIComponent(order.publicAccessToken)}`, appOrigin).toString();
  if (customer.phone || customer.email) {
    const verifyCopy = parsed.data.fulfillmentType === FulfillmentType.PICKUP
      ? `Pickup code: ${verificationCode}. Bring this code and your phone number when collecting.`
      : `Delivery verification code: ${verificationCode}. Share it only after receiving the order.`;
    const body = `${shop.name}: order ${order.receiptNumber} received. ${verifyCopy} Track: ${trackUrl}`;
    await Promise.allSettled([
      customer.phone ? sendDirectMessage({ channel: NotificationChannel.SMS, recipientName: customer.name, recipientPhone: customer.phone, subject: `Order ${order.receiptNumber}`, body, metadata: { orderId: order.id, securityMessage: true } }) : null,
      customer.phone ? sendDirectMessage({ channel: NotificationChannel.WHATSAPP, recipientName: customer.name, recipientPhone: customer.phone, subject: `Order ${order.receiptNumber}`, body, metadata: { orderId: order.id, securityMessage: true } }) : null,
      !customer.phone && customer.email ? sendDirectMessage({ channel: NotificationChannel.EMAIL, recipientName: customer.name, recipientEmail: customer.email, subject: `Order ${order.receiptNumber}`, body, metadata: { orderId: order.id, securityMessage: true } }) : null,
    ]);
  }

  if (paymentRedirect) return redirectTo(request, paymentRedirect);
  return redirectTo(request, `/track/${order.receiptNumber}?access=${encodeURIComponent(order.publicAccessToken)}`);
}
