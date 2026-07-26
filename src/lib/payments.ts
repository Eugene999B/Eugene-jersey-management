import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const PAYSTACK_TIMEOUT_MS = Math.max(5_000, Math.min(30_000, Number(process.env.PAYSTACK_TIMEOUT_MS ?? 15_000)));

type PaystackInitInput = {
  email: string;
  amount: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
  subaccount?: string | null;
  transactionCharge?: number | null;
  bearer?: "account" | "subaccount" | "all-proportional" | "all" | null;
};

type PaystackInitResult = { authorizationUrl: string | null; reference: string; providerEnabled: boolean };

export function amountToSubunit(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100);
}

function secretKey() {
  return process.env.PAYSTACK_SECRET_KEY;
}

export function isPaystackCheckoutReady(config?: { allowCard?: boolean | null; paystackSubaccountCode?: string | null } | null) {
  return Boolean(secretKey() && config?.allowCard && config.paystackSubaccountCode);
}

export async function initializePaystackTransaction(input: PaystackInitInput): Promise<PaystackInitResult> {
  const key = secretKey();
  if (!key) return { authorizationUrl: null, reference: input.reference, providerEnabled: false };

  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: input.email,
      amount: amountToSubunit(input.amount),
      currency: input.currency,
      reference: input.reference,
      callback_url: input.callbackUrl,
      subaccount: input.subaccount || undefined,
      transaction_charge: input.transactionCharge ?? undefined,
      bearer: input.bearer || undefined,
      metadata: input.metadata,
    }),
    signal: AbortSignal.timeout(PAYSTACK_TIMEOUT_MS),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as {
    status?: boolean;
    message?: string;
    data?: { authorization_url?: string; reference?: string };
  } | null;
  if (!response.ok || !payload?.status || !payload.data?.authorization_url) {
    throw new Error(payload?.message ?? "Paystack transaction initialization failed.");
  }
  return { authorizationUrl: payload.data.authorization_url, reference: payload.data.reference ?? input.reference, providerEnabled: true };
}

export function verifyPaystackWebhookSignature(rawBody: string, signature: string | null) {
  const key = secretKey();
  if (!key || !signature || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expectedBuffer = Buffer.from(createHmac("sha512", key).update(rawBody).digest("hex"), "hex");
  const signatureBuffer = Buffer.from(signature, "hex");
  return expectedBuffer.length === signatureBuffer.length && timingSafeEqual(expectedBuffer, signatureBuffer);
}

export type PaystackTransactionData = {
  id?: number | string;
  status?: string;
  reference?: string;
  amount?: number;
  currency?: string;
  channel?: string;
  gateway_response?: string;
};

export async function verifyPaystackTransaction(reference: string) {
  const key = secretKey();
  if (!key) return null;
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(PAYSTACK_TIMEOUT_MS),
    cache: "no-store",
  }).catch(() => null);
  if (!response) return null;
  const payload = await response.json().catch(() => null) as { status?: boolean; data?: PaystackTransactionData } | null;
  if (!response.ok || !payload?.status || !payload.data) return null;
  return payload.data;
}

export async function settlePaystackTransaction(data: PaystackTransactionData) {
  const reference = data.reference;
  if (!reference) return { status: "ignored" as const, reason: "missing-reference" };

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { providerReference: reference },
      include: { order: { include: { shop: true } } },
    });
    if (!payment) return { status: "ignored" as const, reason: "payment-not-found" };
    if (payment.status === PaymentStatus.SUCCESS && payment.verifiedAt) {
      return { status: "processed" as const, payment, reason: "already-verified" };
    }

    const fail = async (reason: string, message: string) => {
      await tx.payment.updateMany({
        where: { id: payment.id, status: { not: PaymentStatus.SUCCESS } },
        data: { status: PaymentStatus.FAILED, gatewayResponse: message, providerChannel: data.channel },
      });
      const updated = await tx.payment.findUniqueOrThrow({ where: { id: payment.id }, include: { order: true } });
      return { status: "failed" as const, payment: updated, reason };
    };

    if (data.status !== "success") return fail(data.status ?? "not-success", data.gateway_response ?? data.status ?? "Payment not successful");
    const expectedAmount = amountToSubunit(Number(payment.amount));
    if (typeof data.amount !== "number") return fail("missing-amount", "Verified provider response did not include an amount.");
    if (data.amount !== expectedAmount) return fail("amount-mismatch", `Amount mismatch: expected ${expectedAmount}, got ${data.amount}`);
    if (!data.currency) return fail("missing-currency", "Verified provider response did not include a currency.");
    if (data.currency.toUpperCase() !== payment.order.shop.currency.toUpperCase()) {
      return fail("currency-mismatch", `Currency mismatch: expected ${payment.order.shop.currency}, got ${data.currency}`);
    }
    if (payment.order.status === OrderStatus.CANCELLED || payment.order.stockReleasedAt) {
      return fail("reservation-released", "Payment arrived after the order reservation was released. Manual reconciliation or refund is required.");
    }

    const changed = await tx.payment.updateMany({
      where: { id: payment.id, status: { not: PaymentStatus.SUCCESS } },
      data: {
        status: PaymentStatus.SUCCESS,
        verifiedAt: new Date(),
        gatewayResponse: data.gateway_response ?? "Successful",
        providerChannel: data.channel,
      },
    });
    if (changed.count !== 1) {
      const current = await tx.payment.findUniqueOrThrow({ where: { id: payment.id }, include: { order: true } });
      return { status: "processed" as const, payment: current, reason: "already-verified" };
    }
    const updated = await tx.payment.findUniqueOrThrow({ where: { id: payment.id }, include: { order: true } });
    return { status: "processed" as const, payment: updated, reason: "verified" };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
}
