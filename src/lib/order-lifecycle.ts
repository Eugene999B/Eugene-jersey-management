import "server-only";

import { OrderChannel, OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const cancellableUnpaidStatuses = [OrderStatus.PENDING, OrderStatus.IN_PRODUCTION, OrderStatus.READY];

export type ReservationReleaseResult = {
  released: boolean;
  reason: "released" | "not-found" | "already-released" | "not-cancellable" | "paid" | "changed";
};

export async function releaseUnpaidOnlineReservation(input: {
  orderId: string;
  reason: string;
  now?: Date;
}): Promise<ReservationReleaseResult> {
  const now = input.now ?? new Date();

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      include: {
        items: { include: { productVariant: { include: { product: true } } } },
        payments: true,
      },
    });

    if (!order) return { released: false, reason: "not-found" };
    if (order.stockReleasedAt || order.status === OrderStatus.CANCELLED) return { released: false, reason: "already-released" };
    if (order.channel !== OrderChannel.ONLINE || !cancellableUnpaidStatuses.includes(order.status)) return { released: false, reason: "not-cancellable" };
    if (order.payments.some((payment) => payment.status === PaymentStatus.SUCCESS)) return { released: false, reason: "paid" };

    const claimed = await tx.order.updateMany({
      where: {
        id: order.id,
        channel: OrderChannel.ONLINE,
        status: { in: cancellableUnpaidStatuses },
        stockReleasedAt: null,
        payments: { none: { status: PaymentStatus.SUCCESS } },
      },
      data: {
        status: OrderStatus.CANCELLED,
        stockReleasedAt: now,
        cancellationReason: input.reason,
      },
    });
    if (claimed.count !== 1) return { released: false, reason: "changed" };

    for (const item of order.items) {
      if (!item.productVariant.product.isService) {
        await tx.productVariant.update({
          where: { id: item.productVariantId },
          data: { stockQty: { increment: item.quantity } },
        });
      }
    }

    await tx.payment.updateMany({
      where: { orderId: order.id, status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.FAILED, gatewayResponse: input.reason },
    });

    if (order.couponId) {
      await tx.coupon.updateMany({
        where: { id: order.couponId, usedCount: { gt: 0 } },
        data: { usedCount: { decrement: 1 } },
      });
    }

    await tx.auditLog.create({
      data: {
        shopId: order.shopId,
        action: "reservation.stock_released",
        entityType: "Order",
        entityId: order.id,
        metadata: { receiptNumber: order.receiptNumber, reason: input.reason },
      },
    });

    return { released: true, reason: "released" };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
}
