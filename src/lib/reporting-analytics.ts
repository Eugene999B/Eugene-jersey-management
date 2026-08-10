import type { PaymentMethod, PaymentStatus } from "@prisma/client";

export type MoneyLike = number | { toString(): string } | null | undefined;

export function money(value: MoneyLike) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function recognizedPayment(status: PaymentStatus | string, method: PaymentMethod | string) {
  return status === "SUCCESS" || method === "STORE_CREDIT";
}

export function paymentMethodTotals(payments: Array<{ amount: MoneyLike; method: PaymentMethod | string; status: PaymentStatus | string }>) {
  const totals = { CASH: 0, CARD: 0, MOMO: 0, STORE_CREDIT: 0, total: 0 };
  for (const payment of payments) {
    if (!recognizedPayment(payment.status, payment.method)) continue;
    const amount = money(payment.amount);
    if (payment.method === "CASH") totals.CASH += amount;
    if (payment.method === "CARD") totals.CARD += amount;
    if (payment.method === "MOMO") totals.MOMO += amount;
    if (payment.method === "STORE_CREDIT") totals.STORE_CREDIT += amount;
    totals.total += amount;
  }
  return totals;
}

export function outstandingOrderBalance(order: {
  totalAmount: MoneyLike;
  payments: Array<{ amount: MoneyLike; method: PaymentMethod | string; status: PaymentStatus | string }>;
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
