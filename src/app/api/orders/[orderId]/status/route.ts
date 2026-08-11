import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OrderChannel, OrderStatus, PaymentStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { releaseUnpaidOnlineReservation } from "@/lib/order-lifecycle";
import { getOrderWorkflow, recordOrderWorkflowEvent } from "@/lib/order-workflow";
import { isTrustedApplicationOrigin } from "@/lib/request-origin";

const schema = z.object({
  status: z.nativeEnum(OrderStatus),
  rush: z.boolean().optional(),
  note: z.string().trim().max(800).optional(),
});
const designerAllowed: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.IN_PRODUCTION],
  IN_PRODUCTION: [OrderStatus.READY],
  READY: [],
  COMPLETED: [],
  CANCELLED: [],
};
const statusTransitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.IN_PRODUCTION, OrderStatus.CANCELLED],
  IN_PRODUCTION: [OrderStatus.READY, OrderStatus.CANCELLED],
  READY: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

type RouteContext = { params: Promise<{ orderId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await requireRole(permissions.orders);
  if (!session.shopId) return NextResponse.json({ error: "Missing shop context." }, { status: 403 });
  if (!isTrustedApplicationOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });

  const { orderId } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid status payload." }, { status: 400 });

  const order = await prisma.order.findFirst({
    where: { id: orderId, shopId: session.shopId },
    include: { payments: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  if (session.role === Role.DESIGNER && !designerAllowed[order.status].includes(parsed.data.status)) {
    return NextResponse.json({ error: "Designer role can only move orders toward Ready." }, { status: 403 });
  }
  if (parsed.data.status !== order.status && !statusTransitions[order.status].includes(parsed.data.status)) {
    return NextResponse.json({ error: `Orders cannot move from ${order.status} to ${parsed.data.status}.` }, { status: 409 });
  }

  if (parsed.data.status === OrderStatus.IN_PRODUCTION && order.status !== OrderStatus.IN_PRODUCTION) {
    const workflow = await getOrderWorkflow(session.shopId, order.id);
    if (workflow && ["PENDING", "CHANGES_REQUESTED"].includes(workflow.approvalStatus)) {
      return NextResponse.json({
        error: workflow.approvalStatus === "CHANGES_REQUESTED"
          ? "Customer changes are still required before production can start."
          : "Customer approval is required before production can start.",
      }, { status: 409 });
    }
  }

  if (parsed.data.status === OrderStatus.CANCELLED && order.channel === OrderChannel.ONLINE) {
    if (order.status !== OrderStatus.PENDING) {
      return NextResponse.json({
        error: "This online order has already entered production. Its reserved stock cannot be returned automatically; use the production cancellation workflow so consumed stock and waste stay accurate.",
      }, { status: 409 });
    }
    const result = await releaseUnpaidOnlineReservation({
      orderId: order.id,
      reason: parsed.data.note || `Cancelled by ${session.name} before confirmed payment.`,
    });
    if (!result.released) {
      const error = result.reason === "paid"
        ? "Paid online orders require the refund/return workflow before cancellation."
        : result.reason === "not-cancellable"
          ? "This reservation can no longer be released because production has started."
          : "This order changed before cancellation. Refresh and try again.";
      return NextResponse.json({ error }, { status: 409 });
    }
    await recordOrderWorkflowEvent({
      shopId: session.shopId,
      orderId: order.id,
      actorId: session.id,
      type: "CANCELLED",
      fromStatus: order.status,
      toStatus: OrderStatus.CANCELLED,
      note: parsed.data.note || `Cancelled by ${session.name}.`,
      metadata: { channel: order.channel, stockReleased: true },
    });
    return NextResponse.json({ ok: true, order: { ...order, status: OrderStatus.CANCELLED } });
  }

  if (parsed.data.status === OrderStatus.COMPLETED) {
    if (order.pickupCodeHash) return NextResponse.json({ error: "Verify pickup or delivery before completing this order." }, { status: 409 });
    const hasSuccessfulPayment = order.payments.some((payment) => payment.status === PaymentStatus.SUCCESS || payment.method === "STORE_CREDIT");
    if (!hasSuccessfulPayment) return NextResponse.json({ error: "A confirmed payment or approved store credit is required before completion." }, { status: 409 });
  }

  const changed = await prisma.order.updateMany({
    where: { id: order.id, shopId: session.shopId, status: order.status },
    data: { status: parsed.data.status, rush: parsed.data.rush ?? order.rush },
  });
  if (changed.count !== 1) return NextResponse.json({ error: "This order changed. Refresh and try again." }, { status: 409 });

  const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  if (parsed.data.status !== order.status) {
    await recordOrderWorkflowEvent({
      shopId: session.shopId,
      orderId: order.id,
      actorId: session.id,
      type: parsed.data.status === OrderStatus.CANCELLED ? "CANCELLED" : "STATUS_CHANGED",
      fromStatus: order.status,
      toStatus: parsed.data.status,
      note: parsed.data.note,
      metadata: { rush: updated.rush },
    });
  }
  await prisma.notification.create({
    data: {
      shopId: session.shopId,
      title: "Order status updated",
      message: `Order ${order.receiptNumber} is now ${parsed.data.status}.`,
      status: "QUEUED",
      channel: "IN_APP",
      metadata: { orderId: order.id },
    },
  });
  await audit({
    shopId: session.shopId,
    userId: session.id,
    action: "orders.status_changed",
    entityType: "Order",
    entityId: order.id,
    metadata: { from: order.status, to: parsed.data.status, rush: updated.rush, note: parsed.data.note },
  });
  return NextResponse.json({ ok: true, order: updated });
}
