import type { PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";

export type PaymentAccountingMoney = number | string | { toString(): string } | null | undefined;

export type PaymentAccountingRow = {
  amount: PaymentAccountingMoney;
  method: PaymentMethod | string;
  status: PaymentStatus | string;
  metadata?: Prisma.JsonValue | Record<string, unknown> | null;
};

function money(value: PaymentAccountingMoney) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function metadataRecord(value: PaymentAccountingRow["metadata"]) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function processedRefundAmountFromMetadata(metadata: PaymentAccountingRow["metadata"]) {
  const value = Number(metadataRecord(metadata).refundProcessedAmount ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function netRecognizedPaymentAmount(payment: PaymentAccountingRow) {
  const amount = money(payment.amount);
  if (payment.method === "STORE_CREDIT") return amount;
  if (payment.status === "REFUNDED") return 0;
  if (payment.status !== "SUCCESS") return 0;
  return Math.max(0, amount - processedRefundAmountFromMetadata(payment.metadata));
}

export function refundAdjustedPaymentTotals(payments: PaymentAccountingRow[]) {
  const totals = { CASH: 0, CARD: 0, MOMO: 0, STORE_CREDIT: 0, total: 0, refunded: 0 };
  for (const payment of payments) {
    const gross = money(payment.amount);
    const net = netRecognizedPaymentAmount(payment);
    const refunded = payment.status === "REFUNDED"
      ? gross
      : Math.min(gross, processedRefundAmountFromMetadata(payment.metadata));

    if (payment.method === "CASH") totals.CASH += net;
    if (payment.method === "CARD") totals.CARD += net;
    if (payment.method === "MOMO") totals.MOMO += net;
    if (payment.method === "STORE_CREDIT") totals.STORE_CREDIT += net;
    totals.total += net;
    totals.refunded += refunded;
  }
  return totals;
}
