import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { NotificationChannel, PaymentMethod, PaymentStatus, OrderStatus, Role } from "@prisma/client";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { sendCustomerMessage } from "@/lib/messaging";
import { normalizePhone } from "@/lib/phone";

const checkoutSchema = z.object({
  customerName: z.string().trim().max(100).optional(),
  customerId: z.string().optional(),
  customerPhone: z.string().trim().max(24).optional(),
  customerEmail: z.string().email().optional(),
  paymentMethod: z.nativeEnum(PaymentMethod),
  creditDueDate: z.coerce.date().optional(),
  creditInstallments: z.coerce.number().int().min(1).max(12).default(1),
  discountAmount: z.coerce.number().min(0).default(0),
  discountReason: z.string().trim().max(180).optional(),
  paymentReference: z.string().trim().max(120).optional(),
  paymentConfirmed: z.boolean().default(false),
  idempotencyKey: z.string().min(8).max(100),
  notes: z.string().trim().max(500).optional(),
  items: z.array(z.object({
    variantId: z.string().min(1),
    quantity: z.number().int().positive().max(100),
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
  return `${prefix || "SHOP"}-${Date.now().toString().slice(-7)}-${nanoid(4).toUpperCase()}`;
}

function installmentDates(firstDueDate: Date, count: number) {
  return Array.from({ length: count }).map((_, index) => {
    const dueDate = new Date(firstDueDate);
    dueDate.setMonth(dueDate.getMonth() + index);
    return dueDate;
  });
}

export async function POST(request: NextRequest) {
  const session = await requireRole(permissions.pos);
  if (!session.shopId) {
    return NextResponse.json({ error: "Missing shop context." }, { status: 403 });
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid checkout payload." }, { status: 400 });
  }

  const previousOrder = await prisma.order.findUnique({
    where: { idempotencyKey: parsed.data.idempotencyKey },
    select: { id: true, shopId: true, receiptNumber: true, totalAmount: true },
  });
  if (previousOrder) {
    if (previousOrder.shopId !== session.shopId) return NextResponse.json({ error: "Checkout key conflict." }, { status: 409 });
    return NextResponse.json({
      orderId: previousOrder.id,
      receiptNumber: previousOrder.receiptNumber,
      totalAmount: Number(previousOrder.totalAmount),
      receiptUrl: `/api/receipts/${previousOrder.id}`,
      duplicate: true,
    });
  }

  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: session.shopId } });
  const selectedCustomer = parsed.data.customerId
    ? await prisma.customer.findFirst({ where: { id: parsed.data.customerId, shopId: session.shopId } })
    : null;
  if (parsed.data.customerId && !selectedCustomer) {
    return NextResponse.json({ error: "The selected customer is not available in this shop." }, { status: 400 });
  }
  const itemQuantities = parsed.data.items.reduce((totals, item) => totals.set(item.variantId, (totals.get(item.variantId) ?? 0) + item.quantity), new Map<string, number>());
  const variantIds = [...itemQuantities.keys()];
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds }, product: { shopId: session.shopId } },
    include: { product: true },
  });

  if (variants.length !== variantIds.length) {
    return NextResponse.json({ error: "One or more products are unavailable." }, { status: 404 });
  }

  const variantById = new Map(variants.map((variant) => [variant.id, variant]));
  let subtotal = 0;

  for (const [variantId, quantity] of itemQuantities) {
    const variant = variantById.get(variantId);
    if (!variant) continue;
    if (!variant.product.isService && variant.stockQty < quantity) {
      return NextResponse.json({ error: `${variant.sku} has only ${variant.stockQty} in stock.` }, { status: 409 });
    }
  }
  subtotal = parsed.data.items.reduce((sum, item) => {
    const variant = variantById.get(item.variantId)!;
    return sum + Number(variant.priceOverride ?? variant.product.basePrice) * item.quantity;
  }, 0);

  const discountAmount = Math.min(parsed.data.discountAmount, subtotal);
  const totalAmount = Math.max(subtotal - discountAmount, 0);
  const isCredit = parsed.data.paymentMethod === PaymentMethod.STORE_CREDIT;
  const isExternalTender = parsed.data.paymentMethod === PaymentMethod.CARD || parsed.data.paymentMethod === PaymentMethod.MOMO;

  if (isCredit && !selectedCustomer && !parsed.data.customerName) {
    return NextResponse.json({ error: "Customer name is required for credit sales." }, { status: 400 });
  }
  if (discountAmount > 0 && !parsed.data.discountReason) {
    return NextResponse.json({ error: "Add a reason for the discount." }, { status: 400 });
  }
  if (subtotal > 0 && discountAmount / subtotal > 0.2 && session.role === Role.CASHIER) {
    return NextResponse.json({ error: "Discounts above 20% require a manager or owner." }, { status: 403 });
  }
  if (isExternalTender && (!parsed.data.paymentConfirmed || !parsed.data.paymentReference)) {
    return NextResponse.json({ error: "Confirm the external payment and enter its terminal or mobile-money reference." }, { status: 400 });
  }
  if (isCredit && parsed.data.creditDueDate && parsed.data.creditDueDate < new Date(new Date().setHours(0, 0, 0, 0))) {
    return NextResponse.json({ error: "Credit due date cannot be in the past." }, { status: 400 });
  }
  const externalProviderReference = isExternalTender ? `POS-${parsed.data.paymentMethod}-${parsed.data.paymentReference}` : null;
  if (externalProviderReference) {
    const reused = await prisma.payment.findFirst({ where: { providerReference: externalProviderReference, status: PaymentStatus.SUCCESS, order: { shopId: session.shopId } }, select: { id: true } });
    if (reused) return NextResponse.json({ error: "That external payment reference has already been recorded in this shop." }, { status: 409 });
  }

  const publicAccessToken = nanoid(32);

  let checkoutResult;
  try {
    checkoutResult = await prisma.$transaction(async (tx) => {
      const normalizedCustomerPhone = parsed.data.customerPhone ? normalizePhone(parsed.data.customerPhone) : undefined;
      const customerMatch = !selectedCustomer && (normalizedCustomerPhone || parsed.data.customerEmail)
        ? await tx.customer.findFirst({ where: { shopId: session.shopId!, OR: [
            ...(normalizedCustomerPhone ? [{ phone: normalizedCustomerPhone }] : []),
            ...(parsed.data.customerEmail ? [{ email: { equals: parsed.data.customerEmail, mode: "insensitive" as const } }] : []),
          ] } })
        : null;
      const customer = selectedCustomer ?? customerMatch ?? (parsed.data.customerName
        ? await tx.customer.create({
            data: {
              shopId: session.shopId!,
              name: parsed.data.customerName,
              phone: normalizedCustomerPhone,
              email: parsed.data.customerEmail,
            },
          })
        : null);

    for (const item of parsed.data.items) {
      const variant = variantById.get(item.variantId);
      if (variant && !variant.product.isService) {
        const updated = await tx.productVariant.updateMany({
          where: { id: item.variantId, stockQty: { gte: item.quantity } },
          data: { stockQty: { decrement: item.quantity } },
        });
        if (updated.count !== 1) throw new Error("INSUFFICIENT_STOCK");
      }
    }

    const createdOrder = await tx.order.create({
      data: {
        shopId: session.shopId!,
        customerId: customer?.id,
        processedById: session.id,
        receiptNumber: receiptNumber(shop.slug),
        publicAccessToken,
        idempotencyKey: parsed.data.idempotencyKey,
        status: OrderStatus.COMPLETED,
        channel: "POS",
        totalAmount,
        discountAmount,
        notes: [parsed.data.notes, discountAmount > 0 ? `Discount: ${parsed.data.discountReason}` : null].filter(Boolean).join("\n") || null,
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
            status: isCredit ? PaymentStatus.PENDING : PaymentStatus.SUCCESS,
            providerReference:
              parsed.data.paymentMethod === PaymentMethod.CASH
                ? `POS-CASH-${nanoid(10)}`
                : parsed.data.paymentMethod === PaymentMethod.STORE_CREDIT
                  ? `POS-CREDIT-${nanoid(10)}`
                  : externalProviderReference,
          },
        },
      },
    });

    if (isCredit && customer) {
      const dueDate = parsed.data.creditDueDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const installmentCount = parsed.data.creditInstallments;
      const installmentAmount = Number((totalAmount / installmentCount).toFixed(2));
      await tx.debt.create({
        data: {
          shopId: session.shopId!,
          customerId: customer.id,
          orderId: createdOrder.id,
          principalAmount: totalAmount,
          dueDate,
          notes: `POS credit sale ${createdOrder.receiptNumber}`,
          installments: {
            create: installmentDates(dueDate, installmentCount).map((installmentDueDate, index) => ({
              amount: index === installmentCount - 1
                ? Number((totalAmount - installmentAmount * (installmentCount - 1)).toFixed(2))
                : installmentAmount,
              dueDate: installmentDueDate,
            })),
          },
        },
      });
    }

      return { order: createdOrder, customer };
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      return NextResponse.json({ error: "Stock changed while checking out. Refresh and try again." }, { status: 409 });
    }
    throw error;
  }

  const { order, customer } = checkoutResult;

  await audit({
    shopId: session.shopId,
    userId: session.id,
    action: "pos.checkout_completed",
    entityType: "Order",
    entityId: order.id,
    metadata: { receiptNumber: order.receiptNumber, paymentMethod: parsed.data.paymentMethod, creditCreated: isCredit },
  });

  if (customer?.phone || customer?.email) {
    const trackUrl = `${(process.env.APP_URL ?? "").replace(/\/$/, "")}/track/${order.receiptNumber}?access=${encodeURIComponent(order.publicAccessToken)}`;
    const receiptBody = `${shop.name}: receipt ${order.receiptNumber} total ${totalAmount.toFixed(2)} ${shop.currency}. Track: ${trackUrl}`;
    await Promise.allSettled([
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
    receiptUrl: `/api/receipts/${order.id}`,
  });
}
