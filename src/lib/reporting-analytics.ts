import type { PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";
import { refundAdjustedPaymentTotals } from "@/lib/payment-accounting";

export type MoneyLike = number | { toString(): string } | null | undefined;

type PaymentRow = {
  amount: MoneyLike;
  method: PaymentMethod | string;
  status: PaymentStatus | string;
  metadata?: Prisma.JsonValue | Record<string, unknown> | null;
};

export function money(value: MoneyLike) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function recognizedPayment(status: PaymentStatus | string, method: PaymentMethod | string) {
  return status === "SUCCESS" || method === "STORE_CREDIT";
}

export function paymentMethodTotals(payments: PaymentRow[]) {
  const totals = refundAdjustedPaymentTotals(payments);
  return {
    CASH: totals.CASH,
    CARD: totals.CARD,
    MOMO: totals.MOMO,
    STORE_CREDIT: totals.STORE_CREDIT,
    total: totals.total,
    refunded: totals.refunded,
  };
}

export function outstandingOrderBalance(order: {
  totalAmount: MoneyLike;
  payments: PaymentRow[];
}) {
  return Math.max(0, money(order.totalAmount) - paymentMethodTotals(order.payments).total);
}

export function financialTruth(input: {
  revenue: MoneyLike;
  garmentCost: MoneyLike;
  materialCost: MoneyLike;
  wasteCost: MoneyLike;
  labourCost: MoneyLike;
  designCharge: MoneyLike;
  pressingCharge: MoneyLike;
  additionalServicesCost: MoneyLike;
}) {
  const totalCost = money(input.garmentCost)
    + money(input.materialCost)
    + money(input.wasteCost)
    + money(input.labourCost)
    + money(input.designCharge)
    + money(input.pressingCharge)
    + money(input.additionalServicesCost);
  const revenue = money(input.revenue);
  const profit = revenue - totalCost;
  return {
    revenue,
    totalCost,
    profit,
    marginPercent: revenue > 0 ? (profit / revenue) * 100 : 0,
  };
}

export function costSnapshotReconciliation(input: {
  storedTotalCost: MoneyLike;
  storedProfit: MoneyLike;
  revenue: MoneyLike;
  garmentCost: MoneyLike;
  materialCost: MoneyLike;
  wasteCost: MoneyLike;
  labourCost: MoneyLike;
  designCharge: MoneyLike;
  pressingCharge: MoneyLike;
  additionalServicesCost: MoneyLike;
}) {
  const truth = financialTruth(input);
  const totalCostDelta = money(input.storedTotalCost) - truth.totalCost;
  const profitDelta = money(input.storedProfit) - truth.profit;
  return {
    ...truth,
    totalCostDelta,
    profitDelta,
    reconciled: Math.abs(totalCostDelta) < 0.01 && Math.abs(profitDelta) < 0.01,
  };
}

export function onTimeSummary(rows: Array<{ dueAt: Date | null; completedAt: Date | null }>) {
  const measurable = rows.filter((row) => row.dueAt && row.completedAt);
  const onTime = measurable.filter((row) => row.completedAt!.getTime() <= row.dueAt!.getTime()).length;
  return {
    measurable: measurable.length,
    onTime,
    late: measurable.length - onTime,
    ratePercent: measurable.length ? (onTime / measurable.length) * 100 : 0,
  };
}

export function reworkSummary(input: { totalRuns: number; reworkedRuns: number }) {
  const totalRuns = Math.max(0, input.totalRuns);
  const reworkedRuns = Math.max(0, Math.min(totalRuns, input.reworkedRuns));
  return {
    totalRuns,
    reworkedRuns,
    ratePercent: totalRuns ? (reworkedRuns / totalRuns) * 100 : 0,
  };
}

export function cashFlowSummary(input: {
  paymentInflows: MoneyLike;
  debtCollections: MoneyLike;
  expenses: MoneyLike;
  refunds: MoneyLike;
}) {
  const inflows = money(input.paymentInflows) + money(input.debtCollections);
  const outflows = money(input.expenses) + money(input.refunds);
  return { inflows, outflows, net: inflows - outflows };
}

export function percentage(part: number, whole: number) {
  return whole > 0 ? (part / whole) * 100 : 0;
}
