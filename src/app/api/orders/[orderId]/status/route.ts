import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OrderStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";
import { audit } from "@/lib/audit";

const schema = z.object({
  status: z.nativeEnum(OrderStatus),
  rush: z.boolean().optional(),
});

const designerAllowed: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.IN_PRODUCTION],
  IN_PRODUCTION: [OrderStatus.READY],
  READY: [],
  COMPLETED: [],
  CANCELLED: [],
};

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await requireRole(permissions.orders);
  if (!session.shopId) {
    return NextResponse.json({ error: "Missing shop context." }, { status: 403 });
  }

  const { orderId } = await context.params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status payload." }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, shopId: session.shopId },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  if (session.role === Role.DESIGNER && !designerAllowed[order.status].includes(parsed.data.status)) {
    return NextResponse.json({ error: "Designer role can only move orders toward Ready." }, { status: 403 });
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: parsed.data.status,
      rush: parsed.data.rush ?? order.rush,
    },
  });

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
    metadata: { from: order.status, to: parsed.data.status, rush: updated.rush },
  });

  return NextResponse.json({ ok: true, order: updated });
}
