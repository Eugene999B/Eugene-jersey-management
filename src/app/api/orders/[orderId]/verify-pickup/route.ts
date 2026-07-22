import { NextRequest, NextResponse } from "next/server";
import { FulfillmentType, OrderStatus, PaymentMethod, PaymentStatus, Role } from "@prisma/client";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { enforceRateLimit } from "@/lib/rate-limit";
import { hashToken } from "@/lib/tokens";

const schema = z.object({
  phone: z.string().min(8).max(24),
  code: z.string().regex(/^\d{6}$/),
  cashCollected: z.boolean().default(false),
});

type RouteContext = { params: Promise<{ orderId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await requireRole([Role.OWNER, Role.MANAGER, Role.CASHIER]);
  if (!session.shopId) return NextResponse.json({ error: "Missing shop context." }, { status: 403 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter the full customer phone and 6-digit pickup code." }, { status: 400 });

  const { orderId } = await context.params;
  try {
    await Promise.all([
      enforceRateLimit({ key: `staff-pickup-order:${orderId}`, limit: 8, windowSeconds: 15 * 60 }),
      enforceRateLimit({ key: `staff-pickup-user:${session.id}`, limit: 30, windowSeconds: 15 * 60 }),
    ]);
  } catch {
    return NextResponse.json({ error: "Too many pickup attempts. Wait 15 minutes and try again." }, { status: 429 });
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, shopId: session.shopId },
    include: { buyer: true, customer: true, payments: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.fulfillmentType !== FulfillmentType.PICKUP || order.status !== OrderStatus.READY || !order.pickupCodeHash) {
    return NextResponse.json({ error: "Only a ready, unverified pickup order can be released." }, { status: 409 });
  }
  const expectedPhone = normalizePhone(order.buyer?.phone ?? order.customer?.phone ?? "");
  if (!expectedPhone || expectedPhone !== normalizePhone(parsed.data.phone) || order.pickupCodeHash !== hashToken(parsed.data.code)) {
    return NextResponse.json({ error: "The customer phone or pickup code is incorrect." }, { status: 400 });
  }

  const pendingCash = order.payments.find((payment) => payment.method === PaymentMethod.CASH && payment.status === PaymentStatus.PENDING);
  const pendingOnline = order.payments.some((payment) => payment.method !== PaymentMethod.CASH && payment.status === PaymentStatus.PENDING);
  if (pendingOnline) return NextResponse.json({ error: "Online payment is still pending. Confirm it before releasing this order." }, { status: 409 });
  if (pendingCash && !parsed.data.cashCollected) return NextResponse.json({ error: "Confirm that cash was collected before releasing this order." }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id: order.id, status: OrderStatus.READY, pickupVerifiedAt: null },
      data: {
        status: OrderStatus.COMPLETED,
        pickupVerifiedAt: new Date(),
        customerVerifiedAt: new Date(),
        pickupCodeHash: null,
        pickupCodeLast4: null,
      },
    });
    if (updated.count !== 1) throw new Error("PICKUP_ALREADY_RELEASED");
    if (pendingCash) {
      await tx.payment.update({ where: { id: pendingCash.id }, data: { status: PaymentStatus.SUCCESS, verifiedAt: new Date(), gatewayResponse: "Cash collected at pickup" } });
    }
  });

  await audit({
    shopId: session.shopId,
    userId: session.id,
    action: "orders.pickup_released",
    entityType: "Order",
    entityId: order.id,
    metadata: { receiptNumber: order.receiptNumber, cashCollected: Boolean(pendingCash) },
  });
  return NextResponse.json({ ok: true });
}
