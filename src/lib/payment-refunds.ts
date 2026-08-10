import "server-only";

import {
  PaymentMethod,
  PaymentRefundStatus,
  PaymentStatus,
  Prisma,
  type PaymentRefund,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { toMinorUnits } from "@/lib/payments";

const ACTIVE_REFUND_STATUSES: PaymentRefundStatus[] = [
  PaymentRefundStatus.REQUESTED,
  PaymentRefundStatus.PENDING,
  PaymentRefundStatus.PROCESSING,
  PaymentRefundStatus.NEEDS_ATTENTION,
  PaymentRefundStatus.RECONCILIATION_REQUIRED,
];

const RESERVED_REFUND_STATUSES: PaymentRefundStatus[] = [
  ...ACTIVE_REFUND_STATUSES,
  PaymentRefundStatus.PROCESSED,
];

const PAYSTACK_REFUND_STATUSES: Record<string, PaymentRefundStatus> = {
  pending: PaymentRefundStatus.PENDING,
  processing: PaymentRefundStatus.PROCESSING,
  "needs-attention": PaymentRefundStatus.NEEDS_ATTENTION,
  failed: PaymentRefundStatus.FAILED,
  processed: PaymentRefundStatus.PROCESSED,
};

export type RefundMoneyLike = number | string | { toString(): string } | null | undefined;

function money(value: RefundMoneyLike) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function secretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!key) throw new Error("PAYSTACK_NOT_CONFIGURED");
  return key;
}

async function paystackRequest(path: string, init: RequestInit = {}) {
  return fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
}

export function providerRefundStatus(value: string | null | undefined) {
  return value ? PAYSTACK_REFUND_STATUSES[value.toLowerCase()] ?? null : null;
}

export function processedRefundTotal(refunds: Array<{ amount: RefundMoneyLike; status: PaymentRefundStatus | string }>) {
  return refunds
    .filter((refund) => refund.status === PaymentRefundStatus.PROCESSED || refund.status === "PROCESSED")
    .reduce((sum, refund) => sum + money(refund.amount), 0);
}

export function reservedRefundTotal(refunds: Array<{ amount: RefundMoneyLike; status: PaymentRefundStatus | string }>) {
  return refunds
    .filter((refund) => RESERVED_REFUND_STATUSES.includes(refund.status as PaymentRefundStatus))
    .reduce((sum, refund) => sum + money(refund.amount), 0);
}

export function paymentRefundSummary(input: {
  paymentAmount: RefundMoneyLike;
  paymentStatus: PaymentStatus | string;
  refunds: Array<{ amount: RefundMoneyLike; status: PaymentRefundStatus | string }>;
}) {
  const amount = money(input.paymentAmount);
  const processed = processedRefundTotal(input.refunds);
  const legacyRefund = input.paymentStatus === PaymentStatus.REFUNDED && input.refunds.length === 0 ? amount : 0;
  const refunded = Math.min(amount, Math.max(processed, legacyRefund));
  const captured = input.paymentStatus === PaymentStatus.SUCCESS || input.paymentStatus === PaymentStatus.REFUNDED;
  return {
    capturedGross: captured ? amount : 0,
    refunded,
    netCaptured: captured ? Math.max(0, amount - refunded) : 0,
    refundable: captured ? Math.max(0, amount - reservedRefundTotal(input.refunds) - legacyRefund) : 0,
  };
}

async function syncPaymentRefundStatus(shopId: string, paymentId: string) {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, order: { shopId } },
    select: { id: true, amount: true, status: true },
  });
  if (!payment || ![PaymentStatus.SUCCESS, PaymentStatus.REFUNDED].includes(payment.status)) return;
  const refunds = await prisma.paymentRefund.findMany({
    where: { shopId, paymentId },
    select: { amount: true, status: true },
  });
  const processed = processedRefundTotal(refunds);
  const nextStatus = processed + 0.005 >= money(payment.amount) ? PaymentStatus.REFUNDED : PaymentStatus.SUCCESS;
  if (payment.status !== nextStatus) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: nextStatus } });
  }
}

function providerRecordData(data: unknown) {
  const record = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const status = typeof record.status === "string" ? record.status : null;
  const id = record.id === null || record.id === undefined ? null : String(record.id);
  const refundReference = typeof record.refund_reference === "string"
    ? record.refund_reference
    : typeof record.refundReference === "string"
      ? record.refundReference
      : null;
  return { record, status, id, refundReference };
}

async function applyProviderRefundState(refund: Pick<PaymentRefund, "id" | "shopId" | "paymentId">, data: unknown) {
  const provider = providerRecordData(data);
  const status = providerRefundStatus(provider.status) ?? PaymentRefundStatus.RECONCILIATION_REQUIRED;
  const now = new Date();
  await prisma.paymentRefund.update({
    where: { id: refund.id },
    data: {
      providerRefundId: provider.id ?? undefined,
      providerRefundReference: provider.refundReference ?? undefined,
      providerStatus: provider.status,
      status,
      providerResponse: provider.record as Prisma.InputJsonValue,
      failureMessage: status === PaymentRefundStatus.FAILED
        ? String(provider.record.reason ?? provider.record.message ?? "Paystack refund failed")
        : null,
      failedAt: status === PaymentRefundStatus.FAILED ? now : null,
      processedAt: status === PaymentRefundStatus.PROCESSED ? now : null,
    },
  });
  await syncPaymentRefundStatus(refund.shopId, refund.paymentId);
  return prisma.paymentRefund.findUniqueOrThrow({ where: { id: refund.id } });
}

export async function requestPaymentRefund(input: {
  shopId: string;
  paymentId: string;
  amount: number;
  requestedById: string;
  reason?: string | null;
  customerNote?: string | null;
}) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("REFUND_AMOUNT_INVALID");

  const reserved = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { id: input.paymentId, order: { shopId: input.shopId } },
      include: { order: { select: { id: true, receiptNumber: true } } },
    });
    if (!payment) throw new Error("PAYMENT_NOT_FOUND");
    if (![PaymentMethod.CARD, PaymentMethod.MOMO].includes(payment.method)) throw new Error("PAYMENT_NOT_PAYSTACK");
    if (![PaymentStatus.SUCCESS, PaymentStatus.REFUNDED].includes(payment.status)) throw new Error("PAYMENT_NOT_CAPTURED");
    if (!payment.providerReference) throw new Error("PAYMENT_PROVIDER_REFERENCE_MISSING");

    const existing = await tx.paymentRefund.findMany({
      where: { shopId: input.shopId, paymentId: payment.id },
      select: { amount: true, status: true },
      orderBy: { requestedAt: "asc" },
    });
    if (existing.some((refund) => ACTIVE_REFUND_STATUSES.includes(refund.status))) {
      throw new Error("REFUND_ALREADY_IN_PROGRESS");
    }

    const legacyRefund = payment.status === PaymentStatus.REFUNDED && existing.length === 0 ? money(payment.amount) : 0;
    const available = Math.max(0, money(payment.amount) - reservedRefundTotal(existing) - legacyRefund);
    if (input.amount - available > 0.005) throw new Error("REFUND_AMOUNT_EXCEEDS_AVAILABLE");

    const reason = input.reason?.trim().slice(0, 300) || null;
    const customerNote = input.customerNote?.trim().slice(0, 300) || reason || `Refund for ${payment.order.receiptNumber}`;
    const merchantNote = `ESM refund for ${payment.order.receiptNumber} requested by ${input.requestedById}`;
    return tx.paymentRefund.create({
      data: {
        shopId: input.shopId,
        paymentId: payment.id,
        transactionReference: payment.providerReference,
        amount: new Prisma.Decimal(input.amount.toFixed(2)),
        currency: payment.currency,
        requestedById: input.requestedById,
        reason,
        customerNote,
        merchantNote,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  let response: Response;
  try {
    response = await paystackRequest("/refund", {
      method: "POST",
      body: JSON.stringify({
        transaction: reserved.transactionReference,
        amount: toMinorUnits(money(reserved.amount)),
        currency: reserved.currency,
        customer_note: reserved.customerNote ?? undefined,
        merchant_note: reserved.merchantNote ?? undefined,
      }),
    });
  } catch (error) {
    await prisma.paymentRefund.update({
      where: { id: reserved.id },
      data: {
        status: PaymentRefundStatus.RECONCILIATION_REQUIRED,
        failureMessage: error instanceof Error ? error.message.slice(0, 500) : "Paystack refund request outcome is unknown.",
      },
    });
    return prisma.paymentRefund.findUniqueOrThrow({ where: { id: reserved.id } });
  }

  const payload = await response.json().catch(() => null) as { status?: boolean; message?: string; data?: unknown } | null;
  if (!response.ok || payload?.status !== true || !payload.data) {
    const failureMessage = payload?.message ?? `Paystack refund request failed with HTTP ${response.status}.`;
    const ambiguous = response.status >= 500;
    await prisma.paymentRefund.update({
      where: { id: reserved.id },
      data: {
        status: ambiguous ? PaymentRefundStatus.RECONCILIATION_REQUIRED : PaymentRefundStatus.FAILED,
        providerStatus: ambiguous ? "unknown" : "rejected",
        providerResponse: (payload ?? {}) as Prisma.InputJsonValue,
        failureMessage: failureMessage.slice(0, 500),
        failedAt: ambiguous ? null : new Date(),
      },
    });
    return prisma.paymentRefund.findUniqueOrThrow({ where: { id: reserved.id } });
  }

  return applyProviderRefundState(reserved, payload.data);
}

export async function applyPaystackRefundWebhook(input: {
  transactionReference: string;
  amountMinor: number;
  currency: string;
  status: string;
  refundReference?: string | null;
  payload: Record<string, unknown>;
}) {
  const payment = await prisma.payment.findFirst({
    where: { providerReference: input.transactionReference },
    include: { order: { select: { shopId: true } } },
  });
  if (!payment) throw new Error("REFUND_PAYMENT_NOT_FOUND");

  const amount = input.amountMinor / 100;
  const active = await prisma.paymentRefund.findFirst({
    where: {
      shopId: payment.order.shopId,
      paymentId: payment.id,
      status: { in: ACTIVE_REFUND_STATUSES },
    },
    orderBy: { requestedAt: "asc" },
  });
  const refund = active ?? await prisma.paymentRefund.findFirst({
    where: {
      shopId: payment.order.shopId,
      paymentId: payment.id,
      amount: new Prisma.Decimal(amount.toFixed(2)),
    },
    orderBy: { requestedAt: "desc" },
  });
  if (!refund) throw new Error("REFUND_LEDGER_NOT_FOUND");
  if (Math.abs(money(refund.amount) - amount) > 0.005) throw new Error("REFUND_AMOUNT_MISMATCH");
  if (refund.currency.toUpperCase() !== input.currency.toUpperCase()) throw new Error("REFUND_CURRENCY_MISMATCH");

  const status = providerRefundStatus(input.status);
  if (!status) throw new Error("REFUND_STATUS_UNKNOWN");
  const now = new Date();
  await prisma.paymentRefund.update({
    where: { id: refund.id },
    data: {
      status,
      providerStatus: input.status,
      providerRefundReference: input.refundReference?.trim() || refund.providerRefundReference,
      providerResponse: input.payload as Prisma.InputJsonValue,
      failureMessage: status === PaymentRefundStatus.FAILED ? String(input.payload.reason ?? "Paystack refund failed") : null,
      failedAt: status === PaymentRefundStatus.FAILED ? now : null,
      processedAt: status === PaymentRefundStatus.PROCESSED ? now : null,
    },
  });
  await syncPaymentRefundStatus(payment.order.shopId, payment.id);
  return { refundId: refund.id, shopId: payment.order.shopId, paymentId: payment.id, status };
}

async function verifyPaystackTransactionId(reference: string) {
  const response = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
  const payload = await response.json().catch(() => null) as { status?: boolean; data?: { id?: number | string } } | null;
  if (!response.ok || payload?.status !== true || !payload.data?.id) return null;
  return String(payload.data.id);
}

export async function reconcilePaymentRefund(shopId: string, refundId: string) {
  const refund = await prisma.paymentRefund.findFirst({ where: { id: refundId, shopId } });
  if (!refund) throw new Error("REFUND_NOT_FOUND");

  let providerData: unknown = null;
  if (refund.providerRefundId) {
    const response = await paystackRequest(`/refund/${encodeURIComponent(refund.providerRefundId)}`);
    const payload = await response.json().catch(() => null) as { status?: boolean; data?: unknown } | null;
    if (response.ok && payload?.status === true && payload.data) providerData = payload.data;
  } else {
    const transactionId = await verifyPaystackTransactionId(refund.transactionReference);
    if (transactionId) {
      const response = await paystackRequest(`/refund?transaction=${encodeURIComponent(transactionId)}&perPage=50&page=1`);
      const payload = await response.json().catch(() => null) as { status?: boolean; data?: unknown[] } | null;
      if (response.ok && payload?.status === true && Array.isArray(payload.data)) {
        const matches = payload.data.filter((item) => {
          const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
          return Math.abs(Number(record.amount ?? -1) / 100 - money(refund.amount)) <= 0.005
            && String(record.currency ?? "").toUpperCase() === refund.currency.toUpperCase();
        });
        if (matches.length === 1) providerData = matches[0];
      }
    }
  }

  if (!providerData) {
    return prisma.paymentRefund.update({
      where: { id: refund.id },
      data: {
        status: PaymentRefundStatus.RECONCILIATION_REQUIRED,
        failureMessage: "No unique Paystack refund record could be confirmed. Review the transaction in Paystack before retrying.",
      },
    });
  }

  return applyProviderRefundState(refund, providerData);
}

export async function retryPaymentRefundWithBankDetails(input: {
  shopId: string;
  refundId: string;
  bankId: string;
  accountNumber: string;
}) {
  const refund = await prisma.paymentRefund.findFirst({
    where: { id: input.refundId, shopId: input.shopId, status: PaymentRefundStatus.NEEDS_ATTENTION },
  });
  if (!refund) throw new Error("REFUND_NOT_RETRYABLE");
  if (!refund.providerRefundId) throw new Error("REFUND_PROVIDER_ID_MISSING");

  const response = await paystackRequest(`/refund/retry_with_customer_details/${encodeURIComponent(refund.providerRefundId)}`, {
    method: "POST",
    body: JSON.stringify({
      refund_account_details: {
        currency: refund.currency,
        account_number: input.accountNumber,
        bank_id: input.bankId,
      },
    }),
  });
  const payload = await response.json().catch(() => null) as { status?: boolean; message?: string; data?: unknown } | null;
  if (!response.ok || payload?.status !== true || !payload.data) {
    throw new Error(payload?.message ?? `Paystack refund retry failed with HTTP ${response.status}.`);
  }
  return applyProviderRefundState(refund, payload.data);
}

export async function listPaystackGhanaBanks() {
  const response = await paystackRequest("/bank?country=ghana&currency=GHS&type=ghipss&perPage=100");
  const payload = await response.json().catch(() => null) as {
    status?: boolean;
    data?: Array<{ id?: number; name?: string; code?: string; active?: boolean }>;
  } | null;
  if (!response.ok || payload?.status !== true || !Array.isArray(payload.data)) return [];
  return payload.data
    .filter((bank) => bank.active !== false && bank.id && bank.name)
    .map((bank) => ({ id: String(bank.id), name: String(bank.name), code: bank.code ? String(bank.code) : null }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const activePaymentRefundStatuses = ACTIVE_REFUND_STATUSES;
