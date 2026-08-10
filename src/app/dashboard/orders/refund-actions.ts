"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PaymentRefundStatus, type PaymentRefund } from "@prisma/client";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { syncPaymentRefundAccounting } from "@/lib/payment-refund-accounting";
import { paymentRefundRoles } from "@/lib/payment-refund-access";
import {
  reconcilePaymentRefund,
  requestPaymentRefund,
  retryPaymentRefundWithBankDetails,
} from "@/lib/payment-refunds";

const requestSchema = z.object({
  orderId: z.string().min(1).max(120),
  paymentId: z.string().min(1).max(120),
  amount: z.coerce.number().positive().max(100_000_000),
  reason: z.string().trim().max(300).optional(),
  customerNote: z.string().trim().max(300).optional(),
});

const reconcileSchema = z.object({
  orderId: z.string().min(1).max(120),
  refundId: z.string().min(1).max(120),
});

const retrySchema = reconcileSchema.extend({
  bankId: z.string().trim().min(1).max(40),
  accountNumber: z.string().trim().min(6).max(30),
});

function resultCode(status: PaymentRefundStatus) {
  return status.toLowerCase().replaceAll("_", "-");
}

function errorCode(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "PAYSTACK_NOT_CONFIGURED") return "paystack-not-configured";
  if (message === "PAYMENT_NOT_FOUND") return "payment-not-found";
  if (message === "PAYMENT_NOT_PAYSTACK") return "not-paystack";
  if (message === "PAYMENT_NOT_CAPTURED") return "not-captured";
  if (message === "PAYMENT_PROVIDER_REFERENCE_MISSING") return "missing-reference";
  if (message === "REFUND_ALREADY_IN_PROGRESS") return "already-in-progress";
  if (message === "REFUND_AMOUNT_EXCEEDS_AVAILABLE") return "amount-exceeds-available";
  if (message === "REFUND_AMOUNT_INVALID") return "invalid-amount";
  if (message === "REFUND_NOT_FOUND") return "refund-not-found";
  if (message === "REFUND_NOT_RETRYABLE") return "not-retryable";
  if (message === "REFUND_PROVIDER_ID_MISSING") return "missing-provider-id";
  if (message === "REFUND_BANK_DETAILS_INVALID") return "bank-details-invalid";
  return "provider-error";
}

function revalidateRefundSurfaces(orderId: string) {
  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/closing");
  revalidatePath("/admin/integrations");
}

async function recordRefundAudit(input: {
  session: { id: string; shopId: string };
  refund: PaymentRefund;
  action: string;
  includeAmount?: boolean;
}) {
  await audit({
    shopId: input.session.shopId,
    userId: input.session.id,
    action: input.action,
    entityType: "PaymentRefund",
    entityId: input.refund.id,
    metadata: {
      paymentId: input.refund.paymentId,
      status: input.refund.status,
      ...(input.includeAmount
        ? { amount: Number(input.refund.amount), currency: input.refund.currency }
        : {}),
    },
  });
}

export async function requestPaymentRefundAction(formData: FormData) {
  const session = await requireRole(paymentRefundRoles);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");

  const parsed = requestSchema.safeParse({
    orderId: formData.get("orderId"),
    paymentId: formData.get("paymentId"),
    amount: formData.get("amount"),
    reason: formData.get("reason") || undefined,
    customerNote: formData.get("customerNote") || undefined,
  });
  if (!parsed.success) redirect("/dashboard/orders?refundError=invalid-request");

  let refund: PaymentRefund;
  try {
    refund = await requestPaymentRefund({
      shopId: session.shopId,
      paymentId: parsed.data.paymentId,
      amount: parsed.data.amount,
      requestedById: session.id,
      reason: parsed.data.reason,
      customerNote: parsed.data.customerNote,
    });
    await syncPaymentRefundAccounting(session.shopId, refund.paymentId);
    await recordRefundAudit({ session: { id: session.id, shopId: session.shopId }, refund, action: "payment.refund_requested", includeAmount: true });
  } catch (error) {
    redirect(`/dashboard/orders/${parsed.data.orderId}?refundError=${errorCode(error)}`);
  }

  revalidateRefundSurfaces(parsed.data.orderId);
  redirect(`/dashboard/orders/${parsed.data.orderId}?refundResult=${resultCode(refund.status)}`);
}

export async function reconcilePaymentRefundAction(formData: FormData) {
  const session = await requireRole(paymentRefundRoles);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");

  const parsed = reconcileSchema.safeParse({
    orderId: formData.get("orderId"),
    refundId: formData.get("refundId"),
  });
  if (!parsed.success) redirect("/dashboard/orders?refundError=invalid-request");

  let refund: PaymentRefund;
  try {
    refund = await reconcilePaymentRefund(session.shopId, parsed.data.refundId);
    await syncPaymentRefundAccounting(session.shopId, refund.paymentId);
    await recordRefundAudit({ session: { id: session.id, shopId: session.shopId }, refund, action: "payment.refund_reconciled" });
  } catch (error) {
    redirect(`/dashboard/orders/${parsed.data.orderId}?refundError=${errorCode(error)}`);
  }

  revalidateRefundSurfaces(parsed.data.orderId);
  redirect(`/dashboard/orders/${parsed.data.orderId}?refundResult=${resultCode(refund.status)}`);
}

export async function retryPaymentRefundAction(formData: FormData) {
  const session = await requireRole(paymentRefundRoles);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");

  const parsed = retrySchema.safeParse({
    orderId: formData.get("orderId"),
    refundId: formData.get("refundId"),
    bankId: formData.get("bankId"),
    accountNumber: formData.get("accountNumber"),
  });
  if (!parsed.success) redirect("/dashboard/orders?refundError=invalid-request");

  let refund: PaymentRefund;
  try {
    refund = await retryPaymentRefundWithBankDetails({
      shopId: session.shopId,
      refundId: parsed.data.refundId,
      bankId: parsed.data.bankId,
      accountNumber: parsed.data.accountNumber,
    });
    await syncPaymentRefundAccounting(session.shopId, refund.paymentId);
    await recordRefundAudit({ session: { id: session.id, shopId: session.shopId }, refund, action: "payment.refund_bank_retry_submitted" });
  } catch (error) {
    redirect(`/dashboard/orders/${parsed.data.orderId}?refundError=${errorCode(error)}`);
  }

  revalidateRefundSurfaces(parsed.data.orderId);
  redirect(`/dashboard/orders/${parsed.data.orderId}?refundResult=${resultCode(refund.status)}`);
}
