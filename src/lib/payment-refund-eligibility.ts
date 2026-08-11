export type RefundEligiblePayment = {
  method: string;
  providerReference?: string | null;
  providerChannel?: string | null;
};

export function isPaystackRefundEligiblePayment(payment: RefundEligiblePayment) {
  if (payment.method !== "CARD" && payment.method !== "MOMO") return false;

  const reference = payment.providerReference?.trim();
  if (!reference) return false;

  const channel = payment.providerChannel?.trim().toUpperCase() ?? "";
  if (channel.startsWith("POS_")) return false;
  if (reference.toUpperCase().startsWith("POS-")) return false;

  return true;
}
