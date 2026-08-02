"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import {
  DeliveryStatus,
  FulfillmentType,
  NotificationChannel,
  OrderChannel,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getBuyerSession } from "@/lib/buyer-session";
import { audit } from "@/lib/audit";
import { createNumericCode } from "@/lib/phone-codes";
import { hashToken } from "@/lib/tokens";
import { initializePaystackTransaction, isPaystackCheckoutReady } from "@/lib/payments";
import { sendDirectMessage } from "@/lib/messaging";
import { releaseUnpaidOnlineReservation } from "@/lib/order-lifecycle";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertOrderCreationAvailable, commercialSubscriptionError } from "@/lib/subscription-hardening";

const addSchema = z.object({
  shopSlug: z.string().trim().min(1).max(120),
  variantId: z.string().min(1).max(100),
  quantity: z.coerce.number().int().positive().max(100),
  personalizationName: z.string().trim().max(80).optional(),
  personalizationNumber: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(1000).optional(),
});
const updateSchema = z.object({ itemId: z.string().min(1).max(100), quantity: z.coerce.number().int().min(0).max(100) });
const checkoutSchema = z.object({
  shopId: z.string().min(1).max(100),
  fulfillmentType: z.nativeEnum(FulfillmentType),
  deliveryZoneId: z.string().max(100).optional(),
  deliveryAddress: z.string().trim().max(500).optional(),
  deliveryCity: z.string().trim().max(100).optional(),
  deliveryArea: z.string().trim().max(150).optional(),
  deliveryNotes: z.string().trim().max(500).optional(),
  couponCode: z.string().trim().max(32).optional(),
  paymentChoice: z.enum(["PAYSTACK", "CASH"]),
  idempotencyKey: z.string().min(8).max(100),
});

function receiptNumber(shopSlug: string) {
  return `${shopSlug.split("-").map((part) => part[0]).join("").slice(0, 4).toUpperCase() || "SHOP"}-${Date.now().toString().slice(-7)}-${nanoid(4).toUpperCase()}`;
}

function couponDiscount(input: { type: "PERCENT" | "FIXED"; value: number; subtotal: number }) {
  if (input.type === "PERCENT") return Math.min(input.subtotal, input.subtotal * Math.min(input.value, 100) / 100);
  return Math.min(input.subtotal, input.value);
}

async function requestContext() {
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || "unknown";
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    try { return { ip, origin: new URL(configured).origin }; } catch { /* use request headers */ }
  }
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") || (process.env.NODE_ENV === "production" ? "https" : "http");
  return { ip, origin: host ? `${protocol}://${host}` : "http://localhost:3000" };
}

export async function addCartItemAction(formData: FormData) {
  const buyer = await getBuyerSession();
  const shopSlug = String(formData.get("shopSlug") ?? "");
  if (!buyer) redirect(`/buyer/login?next=${encodeURIComponent(`/shop/${shopSlug}`)}&error=login-required`);
  const parsed = addSchema.safeParse({
    shopSlug, variantId: formData.get("variantId"), quantity: formData.get("quantity"),
    personalizationName: formData.get("personalizationName") || undefined,
    personalizationNumber: formData.get("personalizationNumber") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) redirect(`/shop/${shopSlug}?error=invalid`);

  const variant = await prisma.productVariant.findFirst({
    where: { id: parsed.data.variantId, product: { shop: { slug: parsed.data.shopSlug, isActive: true, storefrontEnabled: true, publicOrderingEnabled: true, enabledModules: { has: "ONLINE_SELLING" } } } },
    include: { product: { include: { shop: true } } },
  });
  if (!variant) redirect(`/shop/${parsed.data.shopSlug}?error=stock`);

  const current = await prisma.buyerCartItem.findUnique({ where: { buyerId_productVariantId: { buyerId: buyer.id, productVariantId: variant.id } } });
  const nextQuantity = (current?.quantity ?? 0) + parsed.data.quantity;
  if (nextQuantity > 100 || (!variant.product.isService && nextQuantity > variant.stockQty)) redirect(`/shop/${parsed.data.shopSlug}?error=stock`);

  await prisma.buyerCartItem.upsert({
    where: { buyerId_productVariantId: { buyerId: buyer.id, productVariantId: variant.id } },
    create: { buyerId: buyer.id, shopId: variant.product.shopId, productVariantId: variant.id, quantity: nextQuantity, personalizationData: { name: parsed.data.personalizationName ?? "", number: parsed.data.personalizationNumber ?? "", notes: parsed.data.notes ?? "" } },
    update: { quantity: nextQuantity, personalizationData: { name: parsed.data.personalizationName ?? "", number: parsed.data.personalizationNumber ?? "", notes: parsed.data.notes ?? "" } },
  });
  revalidatePath(`/shop/${parsed.data.shopSlug}`);
  redirect(`/cart?shop=${variant.product.shopId}`);
}

export async function updateCartItemAction(formData: FormData) {
  const buyer = await getBuyerSession();
  if (!buyer) redirect("/buyer/login?next=/cart");
  const parsed = updateSchema.safeParse({ itemId: formData.get("itemId"), quantity: formData.get("quantity") });
  if (!parsed.success) redirect("/cart?error=invalid");

  const item = await prisma.buyerCartItem.findFirst({
    where: { id: parsed.data.itemId, buyerId: buyer.id },
    include: { productVariant: { include: { product: { include: { shop: true } } } } },
  });
  if (!item) redirect("/cart?error=invalid");
  if (!item.productVariant.product.shop.isActive || !item.productVariant.product.shop.publicOrderingEnabled || !item.productVariant.product.shop.storefrontEnabled || !item.productVariant.product.shop.enabledModules.includes("ONLINE_SELLING")) redirect("/cart?error=closed");
  if (!item.productVariant.product.isService && parsed.data.quantity > item.productVariant.stockQty) redirect("/cart?error=stock");

  if (parsed.data.quantity === 0) await prisma.buyerCartItem.delete({ where: { id: item.id } });
  else await prisma.buyerCartItem.update({ where: { id: item.id }, data: { quantity: parsed.data.quantity } });
  revalidatePath("/cart");
}

export async function checkoutCartAction(formData: FormData) {
  const buyerSession = await getBuyerSession();
  if (!buyerSession) redirect("/buyer/login?next=/cart");
  const parsed = checkoutSchema.safeParse({
    shopId: formData.get("shopId"), fulfillmentType: formData.get("fulfillmentType"),
    deliveryZoneId: formData.get("deliveryZoneId") || undefined,
    deliveryAddress: formData.get("deliveryAddress") || undefined,
    deliveryCity: formData.get("deliveryCity") || undefined,
    deliveryArea: formData.get("deliveryArea") || undefined,
    deliveryNotes: formData.get("deliveryNotes") || undefined,
    couponCode: formData.get("couponCode") || undefined,
    paymentChoice: formData.get("paymentChoice"), idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) redirect("/cart?error=invalid");
  if (parsed.data.fulfillmentType === FulfillmentType.DELIVERY && !parsed.data.deliveryAddress) redirect("/cart?error=delivery");
  if (parsed.data.fulfillmentType === FulfillmentType.DELIVERY && parsed.data.paymentChoice === "CASH") redirect("/cart?error=delivery-payment");

  const context = await requestContext();
  try {
    await Promise.all([
      enforceRateLimit({ key: `cart-checkout-buyer:${buyerSession.id}`, limit: 10, windowSeconds: 60 * 60 }),
      enforceRateLimit({ key: `cart-checkout-ip:${context.ip}`, limit: 30, windowSeconds: 60 * 60 }),
    ]);
  } catch { redirect("/cart?error=rate"); }

  const buyer = await prisma.buyerAccount.findUnique({ where: { id: buyerSession.id } });
  if (!buyer || !buyer.isActive) redirect("/buyer/login?next=/cart");
  const duplicateOrder = await prisma.order.findUnique({ where: { idempotencyKey: parsed.data.idempotencyKey } });
  if (duplicateOrder) {
    if (duplicateOrder.buyerId === buyer.id) redirect(`/track/${duplicateOrder.receiptNumber}?access=${encodeURIComponent(duplicateOrder.publicAccessToken)}`);
    redirect("/cart?error=duplicate-request");
  }

  const [shop, cartItems, deliveryZone] = await Promise.all([
    prisma.shop.findUnique({ where: { id: parsed.data.shopId }, include: { paymentConfig: true } }),
    prisma.buyerCartItem.findMany({ where: { buyerId: buyer.id, shopId: parsed.data.shopId }, include: { productVariant: { include: { product: true } } }, orderBy: { createdAt: "asc" } }),
    parsed.data.deliveryZoneId ? prisma.deliveryZone.findFirst({ where: { id: parsed.data.deliveryZoneId, shopId: parsed.data.shopId, isActive: true } }) : null,
  ]);
  if (!shop || !shop.isActive || !shop.storefrontEnabled || !shop.publicOrderingEnabled || !shop.enabledModules.includes("ONLINE_SELLING")) redirect("/cart?error=closed");
  try {
    await assertOrderCreationAvailable({ shopId: shop.id, channel: OrderChannel.ONLINE });
  } catch (error) {
    if (commercialSubscriptionError(error)) redirect("/cart?error=subscription");
    throw error;
  }
  if (parsed.data.paymentChoice === "PAYSTACK" && !isPaystackCheckoutReady(shop.paymentConfig)) redirect("/cart?error=payment");
  if (parsed.data.paymentChoice === "CASH" && !shop.paymentConfig?.allowCash) redirect("/cart?error=payment");
  if (!cartItems.length) redirect("/cart?error=empty");
  if (parsed.data.fulfillmentType === FulfillmentType.DELIVERY && !deliveryZone) redirect("/cart?error=delivery-zone");

  let subtotal = 0;
  for (const item of cartItems) {
    if (!item.productVariant.product.isService && item.productVariant.stockQty < item.quantity) redirect("/cart?error=stock");
    subtotal += Number(item.productVariant.priceOverride ?? item.productVariant.product.basePrice) * item.quantity;
  }

  const coupon = parsed.data.couponCode ? await prisma.coupon.findFirst({ where: { shopId: shop.id, code: parsed.data.couponCode.toUpperCase(), status: "ACTIVE" } }) : null;
  const now = new Date();
  const couponUsable = coupon && (!coupon.startsAt || coupon.startsAt <= now) && (!coupon.endsAt || coupon.endsAt >= now) && (!coupon.usageLimit || coupon.usedCount < coupon.usageLimit) && (!coupon.minSubtotal || Number(coupon.minSubtotal) <= subtotal);
  const discountAmount = couponUsable ? Number(couponDiscount({ type: coupon.discountType, value: Number(coupon.value), subtotal }).toFixed(2)) : 0;
  const deliveryFee = parsed.data.fulfillmentType === FulfillmentType.DELIVERY ? Number(deliveryZone?.fee ?? 0) : 0;
  const totalAmount = Math.max(subtotal - discountAmount + deliveryFee, 0);
  const verificationCode = createNumericCode();
  const paystackReference = `CART-${shop.slug}-${Date.now()}-${nanoid(6)}`;
  const publicAccessToken = nanoid(32);
  const cashHoldExpiresAt = parsed.data.paymentChoice === "CASH" ? new Date(Date.now() + shop.cashOrderHoldMinutes * 60_000) : null;

  let checkoutResult;
  try {
    checkoutResult = await prisma.$transaction(async (tx) => {
      const matchedCustomer = await tx.customer.findFirst({ where: { shopId: shop.id, OR: [{ phone: buyer.phone }, ...(buyer.email ? [{ email: buyer.email }] : [])] } });
      const customer = matchedCustomer
        ? await tx.customer.update({ where: { id: matchedCustomer.id }, data: { name: buyer.name, phone: buyer.phone, email: buyer.email } })
        : await tx.customer.create({ data: { shopId: shop.id, name: buyer.name, phone: buyer.phone, email: buyer.email, group: "Online" } });

      for (const item of cartItems) {
        if (!item.productVariant.product.isService) {
          const updated = await tx.productVariant.updateMany({ where: { id: item.productVariantId, stockQty: { gte: item.quantity } }, data: { stockQty: { decrement: item.quantity } } });
          if (updated.count !== 1) throw new Error("INSUFFICIENT_STOCK");
        }
      }
      if (couponUsable) {
        const claimed = await tx.coupon.updateMany({ where: { id: coupon.id, ...(coupon.usageLimit ? { usedCount: { lt: coupon.usageLimit } } : {}) }, data: { usedCount: { increment: 1 } } });
        if (claimed.count !== 1) throw new Error("COUPON_EXHAUSTED");
      }

      const order = await tx.order.create({
        data: {
          shopId: shop.id, customerId: customer.id, buyerId: buyer.id, receiptNumber: receiptNumber(shop.slug),
          status: OrderStatus.PENDING, channel: OrderChannel.ONLINE, totalAmount, discountAmount, deliveryFee,
          couponId: couponUsable ? coupon.id : null, deliveryZoneId: deliveryZone?.id ?? null,
          publicAccessToken, idempotencyKey: parsed.data.idempotencyKey, cashHoldExpiresAt,
          paystackReference: parsed.data.paymentChoice === "PAYSTACK" ? paystackReference : null,
          fulfillmentType: parsed.data.fulfillmentType,
          deliveryStatus: parsed.data.fulfillmentType === FulfillmentType.DELIVERY ? DeliveryStatus.REQUESTED : DeliveryStatus.NOT_REQUIRED,
          deliveryAddress: parsed.data.fulfillmentType === FulfillmentType.DELIVERY ? parsed.data.deliveryAddress : null,
          deliveryCity: parsed.data.fulfillmentType === FulfillmentType.DELIVERY ? parsed.data.deliveryCity : null,
          deliveryArea: parsed.data.fulfillmentType === FulfillmentType.DELIVERY ? parsed.data.deliveryArea : null,
          deliveryNotes: parsed.data.fulfillmentType === FulfillmentType.DELIVERY ? parsed.data.deliveryNotes : null,
          pickupCodeHash: hashToken(verificationCode), pickupCodeLast4: verificationCode.slice(-4),
          items: { create: cartItems.map((item) => ({ productVariant: { connect: { id: item.productVariantId } }, quantity: item.quantity, unitPrice: Number(item.productVariant.priceOverride ?? item.productVariant.product.basePrice), personalizationData: item.personalizationData as Prisma.InputJsonValue })) },
          payments: { create: { method: parsed.data.paymentChoice === "PAYSTACK" ? PaymentMethod.CARD : PaymentMethod.CASH, amount: totalAmount, status: PaymentStatus.PENDING, providerReference: parsed.data.paymentChoice === "PAYSTACK" ? paystackReference : "CASH-RESERVATION" } },
        },
      });
      return { order, customer };
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") redirect("/cart?error=stock");
    if (error instanceof Error && error.message === "COUPON_EXHAUSTED") redirect("/cart?error=coupon");
    if (commercialSubscriptionError(error)) redirect("/cart?error=subscription");
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.order.findUnique({ where: { idempotencyKey: parsed.data.idempotencyKey } });
      if (existing?.buyerId === buyer.id) redirect(`/track/${existing.receiptNumber}?access=${encodeURIComponent(existing.publicAccessToken)}`);
      redirect("/cart?error=duplicate-request");
    }
    throw error;
  }

  const { order, customer } = checkoutResult;
  let paymentRedirect: string | null = null;
  if (parsed.data.paymentChoice === "PAYSTACK") {
    try {
      const initialized = await initializePaystackTransaction({
        email: buyer.email ?? `${buyer.id}@buyer.local`, amount: totalAmount, currency: shop.currency, reference: paystackReference,
        callbackUrl: new URL("/api/paystack/callback", context.origin).toString(),
        subaccount: shop.paymentConfig?.paystackSubaccountCode, transactionCharge: shop.paymentConfig?.paystackTransactionCharge,
        bearer: shop.paymentConfig?.paystackChargeBearer as "account" | "subaccount" | "all-proportional" | "all" | null,
        metadata: { orderId: order.id, shopId: shop.id, receiptNumber: order.receiptNumber },
      });
      paymentRedirect = initialized.authorizationUrl;
      if (!paymentRedirect) throw new Error("PAYSTACK_URL_MISSING");
    } catch {
      await releaseUnpaidOnlineReservation({ orderId: order.id, reason: "Paystack cart checkout could not be initialised." });
      redirect("/cart?error=payment-init");
    }
  }

  await prisma.buyerCartItem.deleteMany({ where: { buyerId: buyer.id, shopId: shop.id } });
  await audit({ shopId: shop.id, action: "public.cart_checkout_created", entityType: "Order", entityId: order.id, metadata: { receiptNumber: order.receiptNumber, itemCount: cartItems.length, couponCode: coupon?.code } });

  const trackUrl = new URL(`/track/${order.receiptNumber}?access=${encodeURIComponent(order.publicAccessToken)}`, context.origin).toString();
  const body = `${shop.name}: order ${order.receiptNumber} received. Verification code: ${verificationCode}. Track: ${trackUrl}`;
  await sendDirectMessage({ channel: NotificationChannel.SMS, recipientName: customer.name, recipientPhone: buyer.phone, subject: `Order ${order.receiptNumber}`, body, metadata: { orderId: order.id, securityMessage: true } }).catch(() => null);

  if (paymentRedirect) redirect(paymentRedirect);
  redirect(`/track/${order.receiptNumber}?access=${encodeURIComponent(order.publicAccessToken)}`);
}
