import "server-only";

import { platformDb } from "@/lib/platform-db";
import { isPaystackRefundEligiblePayment } from "@/lib/payment-refund-eligibility";

export async function canonicalPaymentRefundTarget(shopId: string, paymentId: string) {
  const payment = await platformDb.payment.findFirst({
    where: { id: paymentId, order: { shopId } },
    select: {
      orderId: true,
      method: true,
      providerReference: true,
      providerChannel: true,
    },
  });
  if (!payment) throw new Error("PAYMENT_NOT_FOUND");
  if (!isPaystackRefundEligiblePayment(payment)) throw new Error("PAYMENT_NOT_PAYSTACK");
  return payment;
}

export async function canonicalRefundOrderId(shopId: string, refundId: string) {
  const refund = await platformDb.paymentRefund.findFirst({
    where: { id: refundId, shopId },
    select: { paymentId: true },
  });
  if (!refund) throw new Error("REFUND_NOT_FOUND");

  const payment = await platformDb.payment.findFirst({
    where: { id: refund.paymentId, order: { shopId } },
    select: { orderId: true },
  });
  if (!payment) throw new Error("PAYMENT_NOT_FOUND");
  return payment.orderId;
}
