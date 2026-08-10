import "server-only";

import { PaymentRefundStatus, PaymentStatus, Prisma } from "@prisma/client";
import { platformDb } from "@/lib/platform-db";

function metadataRecord(value: Prisma.JsonValue) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function syncPaymentRefundAccounting(shopId: string, paymentId: string) {
  const payment = await platformDb.payment.findFirst({
    where: { id: paymentId, order: { shopId } },
    select: { id: true, amount: true, status: true, metadata: true },
  });
  if (!payment || (payment.status !== PaymentStatus.SUCCESS && payment.status !== PaymentStatus.REFUNDED)) return null;

  const refunds = await platformDb.paymentRefund.findMany({
    where: { shopId, paymentId, status: PaymentRefundStatus.PROCESSED },
    select: { amount: true, processedAt: true },
  });
  const processedAmount = refunds.reduce((sum, refund) => sum + Number(refund.amount), 0);
  const grossAmount = Number(payment.amount);
  const boundedProcessed = Math.min(grossAmount, Math.max(0, processedAmount));
  const nextStatus = boundedProcessed + 0.005 >= grossAmount ? PaymentStatus.REFUNDED : PaymentStatus.SUCCESS;
  const latestProcessedAt = refunds
    .flatMap((refund) => refund.processedAt ? [refund.processedAt] : [])
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  const metadata = {
    ...metadataRecord(payment.metadata),
    refundProcessedAmount: Number(boundedProcessed.toFixed(2)),
    ...(latestProcessedAt ? { refundLastProcessedAt: latestProcessedAt.toISOString() } : {}),
  } as Prisma.InputJsonObject;

  await platformDb.payment.update({
    where: { id: payment.id },
    data: { status: nextStatus, metadata },
  });

  return {
    paymentId: payment.id,
    grossAmount,
    refundedAmount: boundedProcessed,
    netAmount: Math.max(0, grossAmount - boundedProcessed),
    status: nextStatus,
  };
}
