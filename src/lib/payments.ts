import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

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

type PaystackInitResult = {
  authorizationUrl: string | null;
  reference: string;
  providerEnabled: boolean;
};

function amountToSubunit(amount: number) {
  return Math.round(amount * 100);
}

function secretKey() {
  return process.env.PAYSTACK_SECRET_KEY;
}

export function isPaystackCheckoutReady(config?: { allowCard?: boolean | null; paystackSubaccountCode?: string | null } | null) {
  return Boolean(secretKey() && config?.allowCard && config.paystackSubaccountCode);
}

export async function initializePaystackTransaction(input: PaystackInitInput): Promise<PaystackInitResult> {
  const key = secretKey();
  if (!key) {
    return {
      authorizationUrl: null,
      reference: input.reference,
      providerEnabled: false,
    };
  }

  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
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
  });

  const payload = await response.json() as {
    status?: boolean;
    message?: string;
    data?: { authorization_url?: string; reference?: string };
  };

  if (!response.ok || !payload.status || !payload.data?.authorization_url) {
    throw new Error(payload.message ?? "Paystack transaction initialization failed.");
  }

  return {
    authorizationUrl: payload.data.authorization_url,
    reference: payload.data.reference ?? input.reference,
    providerEnabled: true,
  };
}

export function verifyPaystackWebhookSignature(rawBody: string, signature: string | null) {
  const key = secretKey();
  if (!key || !signature) return false;
  const expected = createHmac("sha512", key).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, signatureBuffer);
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
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  });

  const payload = await response.json().catch(() => null) as {
    status?: boolean;
    message?: string;
    data?: PaystackTransactionData;
  } | null;

  if (!response.ok || !payload?.status || !payload.data) return null;
  return payload.data;
}

export async function settlePaystackTransaction(data: PaystackTransactionData) {
  const reference = data.reference;
  if (!reference) return { status: "ignored" as const, reason: "missing-reference" };

  const payment = await prisma.payment.findFirst({
    where: { providerReference: reference },
    include: { order: { include: { shop: true } } },
  });
  if (!payment) return { status: "ignored" as const, reason: "payment-not-found" };
  if (payment.status === PaymentStatus.SUCCESS && payment.verifiedAt) {
    return { status: "processed" as const, payment, reason: "already-verified" };
  }

  if (data.status !== "success") {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED,
        gatewayResponse: data.gateway_response ?? data.status ?? "Payment not successful",
        providerChannel: data.channel,
      },
    });
    return { status: "failed" as const, payment, reason: data.status ?? "not-success" };
  }

  const expectedAmount = amountToSubunit(Number(payment.amount));
  if (typeof data.amount === "number" && data.amount !== expectedAmount) {
    return { status: "failed" as const, payment, reason: "amount-mismatch" };
  }
  if (data.currency && data.currency !== payment.order.shop.currency) {
    return { status: "failed" as const, payment, reason: "currency-mismatch" };
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: PaymentStatus.SUCCESS,
      verifiedAt: new Date(),
      gatewayResponse: data.gateway_response ?? "Successful",
      providerChannel: data.channel,
    },
    include: { order: true },
  });

  return { status: "processed" as const, payment: updated, reason: "verified" };
}
