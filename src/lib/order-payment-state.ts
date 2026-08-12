import type { PaymentAccountingMoney, PaymentAccountingRow } from "@/lib/payment-accounting";
import { netRecognizedPaymentAmount } from "@/lib/payment-accounting";

export type OrderPaymentState = "PAID" | "PART_PAID" | "CREDIT" | "PENDING";

function money(value: PaymentAccountingMoney) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function orderPaymentState(input: {
  totalAmount: PaymentAccountingMoney;
  payments: PaymentAccountingRow[];
}): OrderPaymentState {
  const total = Math.max(0, money(input.totalAmount));
  const paid = input.payments
    .filter((payment) => payment.method !== "STORE_CREDIT")
    .reduce((sum, payment) => sum + netRecognizedPaymentAmount(payment), 0);
  const credit = input.payments
    .filter((payment) => payment.method === "STORE_CREDIT" && payment.status === "PENDING")
    .reduce((sum, payment) => sum + Math.max(0, money(payment.amount)), 0);

  if (total <= 0.005 || paid + 0.005 >= total) return "PAID";
  if (paid > 0.005) return "PART_PAID";
  if (credit > 0.005) return "CREDIT";
  return "PENDING";
}

export function orderPaymentStateLabel(input: {
  totalAmount: PaymentAccountingMoney;
  payments: PaymentAccountingRow[];
}) {
  const state = orderPaymentState(input);
  if (state === "PAID") return "Paid";
  if (state === "PART_PAID") return "Part paid";
  if (state === "CREDIT") return "Credit";
  return "Pending";
}
