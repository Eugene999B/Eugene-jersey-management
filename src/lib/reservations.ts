import { OrderChannel, OrderStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { releaseUnpaidOnlineReservation } from "@/lib/order-lifecycle";

export async function releaseExpiredReservations(now = new Date()) {
  const configuredMinutes = Number(process.env.ONLINE_PAYMENT_HOLD_MINUTES ?? 60);
  const paymentHoldMinutes = Number.isFinite(configuredMinutes) ? Math.max(15, Math.min(24 * 60, configuredMinutes)) : 60;
  const paymentCutoff = new Date(now.getTime() - paymentHoldMinutes * 60_000);
  let released = 0;
  let scanned = 0;

  while (scanned < 500) {
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
      select: { id: true, cashHoldExpiresAt: true },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    if (!orders.length) break;

    for (const order of orders) {
      scanned += 1;
      const reason = order.cashHoldExpiresAt && order.cashHoldExpiresAt < now
        ? "Cash pickup reservation expired."
        : "Online payment was not confirmed before the reservation window expired.";
      const result = await releaseUnpaidOnlineReservation({ orderId: order.id, reason, now });
      if (result.released) released += 1;
    }
    if (orders.length < 100) break;
  }

  return { released, scanned };
}
