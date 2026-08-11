import "server-only";

import { PaymentMethod, PaymentRefundStatus, PaymentStatus } from "@prisma/client";
import { platformDb } from "@/lib/platform-db";

export type TenderTotals = {
  CASH: number;
  CARD: number;
  MOMO: number;
};

export type FinancialPeriodTotals = {
  bookedSales: number;
  bookedOrderCount: number;
  creditSales: number;
  captures: TenderTotals;
  providerRefunds: TenderTotals;
  netTenders: TenderTotals;
  debtCollections: TenderTotals & { total: number };
};

function emptyTenderTotals(): TenderTotals {
  return { CASH: 0, CARD: 0, MOMO: 0 };
}

function addTender(totals: TenderTotals, method: PaymentMethod, amount: number) {
  if (method === PaymentMethod.CASH) totals.CASH += amount;
  if (method === PaymentMethod.CARD) totals.CARD += amount;
  if (method === PaymentMethod.MOMO) totals.MOMO += amount;
}

export async function financialPeriodTotals(shopId: string, start: Date, endExclusive: Date): Promise<FinancialPeriodTotals> {
  const range = { gte: start, lt: endExclusive };
  const [orders, captures, refunds, debtPayments] = await Promise.all([
    platformDb.order.findMany({
      where: { shopId, status: { not: "CANCELLED" }, createdAt: range },
      select: {
        totalAmount: true,
        payments: { where: { method: PaymentMethod.STORE_CREDIT }, select: { amount: true } },
      },
    }),
    platformDb.payment.findMany({
      where: {
        order: { shopId },
        method: { in: [PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.MOMO] },
        status: { in: [PaymentStatus.SUCCESS, PaymentStatus.REFUNDED] },
        OR: [
          { verifiedAt: range },
          { verifiedAt: null, createdAt: range },
        ],
      },
      select: { amount: true, method: true },
    }),
    platformDb.paymentRefund.findMany({
      where: {
        shopId,
        status: PaymentRefundStatus.PROCESSED,
        processedAt: range,
      },
      select: { paymentId: true, amount: true },
    }),
    platformDb.debtPayment.findMany({
      where: { shopId, receivedAt: range },
      select: { amount: true, method: true },
    }),
  ]);

  const refundPaymentIds = [...new Set(refunds.map((refund) => refund.paymentId))];
  const refundPayments = refundPaymentIds.length
    ? await platformDb.payment.findMany({
        where: { id: { in: refundPaymentIds }, order: { shopId } },
        select: { id: true, method: true },
      })
    : [];
  const refundMethodByPaymentId = new Map(refundPayments.map((payment) => [payment.id, payment.method]));

  const captureTotals = emptyTenderTotals();
  for (const payment of captures) addTender(captureTotals, payment.method, Number(payment.amount));

  const refundTotals = emptyTenderTotals();
  for (const refund of refunds) {
    const method = refundMethodByPaymentId.get(refund.paymentId);
    if (method) addTender(refundTotals, method, Number(refund.amount));
  }

  const debtTotals = { ...emptyTenderTotals(), total: 0 };
  for (const payment of debtPayments) {
    const amount = Number(payment.amount);
    addTender(debtTotals, payment.method, amount);
    debtTotals.total += amount;
  }

  const netTenders = {
    CASH: captureTotals.CASH - refundTotals.CASH,
    CARD: captureTotals.CARD - refundTotals.CARD,
    MOMO: captureTotals.MOMO - refundTotals.MOMO,
  };

  return {
    bookedSales: orders.reduce((sum, order) => sum + Number(order.totalAmount), 0),
    bookedOrderCount: orders.length,
    creditSales: orders.reduce(
      (sum, order) => sum + order.payments.reduce((paymentSum, payment) => paymentSum + Number(payment.amount), 0),
      0,
    ),
    captures: captureTotals,
    providerRefunds: refundTotals,
    netTenders,
    debtCollections: debtTotals,
  };
}
