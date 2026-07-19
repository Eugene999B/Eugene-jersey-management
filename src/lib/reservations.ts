import { OrderChannel, OrderStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function releaseExpiredReservations(now = new Date()) {
  const paymentHoldMinutes = Number(process.env.ONLINE_PAYMENT_HOLD_MINUTES ?? 60);
  const paymentCutoff = new Date(now.getTime() - paymentHoldMinutes * 60_000);
  const orders = await prisma.order.findMany({
    where: {
      channel: OrderChannel.ONLINE,
      status: OrderStatus.PENDING,
      stockReleasedAt: null,
      payments: { none: { status: PaymentStatus.SUCCESS } },
      OR: [
        { cashHoldExpiresAt: { lt: now } },
        { paystackReference: { not: null }, createdAt: { lt: paymentCutoff } },
      ],
    },
    include: {
      payments: true,
      items: { include: { productVariant: { include: { product: true } } } },
    },
    take: 100,
  });

  for (const order of orders) {
    await prisma.$transaction(async (tx) => {
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
        data: {
          status: PaymentStatus.FAILED,
          gatewayResponse: "Reservation expired before confirmed payment.",
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
          stockReleasedAt: now,
          cancellationReason: order.cashHoldExpiresAt && order.cashHoldExpiresAt < now
            ? "Cash pickup reservation expired."
            : "Online payment was not confirmed before the reservation window expired.",
        },
      });

      await tx.auditLog.create({
        data: {
          shopId: order.shopId,
          action: "reservation.stock_released",
          entityType: "Order",
          entityId: order.id,
          metadata: { receiptNumber: order.receiptNumber },
        },
      });
    });
  }

  return { released: orders.length };
}
