import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { PaymentProviderEventStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { settleCommunicationCreditPurchase } from "@/lib/communication-credits";
import { syncPaymentRefundAccounting } from "@/lib/payment-refund-accounting";
import { applyPaystackRefundWebhook } from "@/lib/payment-refunds";
import { settlePaystackTransaction, verifyPaystackWebhookSignature, type PaystackTransactionData } from "@/lib/payments";
import { settleSubscriptionInvoicePayment } from "@/lib/subscription-billing";

type PaystackWebhookPayload = {
  event?: string;
  data?: Record<string, unknown>;
};

function stringValue(value: unknown) {
  return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function eventIdentity(eventType: string, data: Record<string, unknown>, rawBody: string) {
  const providerId = data.id === null || data.id === undefined ? "" : String(data.id);
  const fallback = createHash("sha256").update(rawBody).digest("hex");
  if (eventType.startsWith("refund.")) return `${eventType}:${providerId || fallback}`;
  return providerId || fallback;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");
  if (!verifyPaystackWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload: PaystackWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as PaystackWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const eventType = payload.event ?? "unknown";
  const data = payload.data ?? {};
  const reference = eventType.startsWith("refund.")
    ? stringValue(data.transaction_reference).trim() || null
    : stringValue(data.reference).trim() || null;
  const eventId = eventIdentity(eventType, data, rawBody);
  const event = await prisma.paymentProviderEvent.upsert({
    where: { provider_eventId: { provider: "paystack", eventId } },
    create: {
      provider: "paystack",
      eventType,
      eventId,
      reference,
      payload: payload as object,
      status: PaymentProviderEventStatus.RECEIVED,
    },
    update: {},
  });

  const claimed = await prisma.paymentProviderEvent.updateMany({
    where: {
      id: event.id,
      OR: [
        { processedAt: null },
        { status: PaymentProviderEventStatus.FAILED },
      ],
    },
    data: { processedAt: new Date(), status: PaymentProviderEventStatus.RECEIVED },
  });
  if (claimed.count !== 1) return NextResponse.json({ received: true, duplicate: true });

  try {
    if (eventType.startsWith("refund.")) {
      const transactionReference = stringValue(data.transaction_reference).trim();
      const amountMinor = numberValue(data.amount);
      const currency = stringValue(data.currency).trim().toUpperCase();
      const providerStatus = stringValue(data.status).trim().toLowerCase() || eventType.replace(/^refund\./, "");
      const providerRefundId = data.id === null || data.id === undefined ? null : String(data.id);
      const refundReference = stringValue(data.refund_reference).trim() || null;

      if (!transactionReference || !Number.isFinite(amountMinor) || amountMinor <= 0 || !currency || !providerStatus) {
        await prisma.paymentProviderEvent.update({
          where: { id: event.id },
          data: { status: PaymentProviderEventStatus.FAILED },
        });
        return NextResponse.json({ error: "Incomplete refund payload." }, { status: 400 });
      }

      const refundResult = await applyPaystackRefundWebhook({
        transactionReference,
        amountMinor,
        currency,
        status: providerStatus,
        providerRefundId,
        refundReference,
        payload: data,
      });
      await syncPaymentRefundAccounting(refundResult.shopId, refundResult.paymentId);
      await prisma.paymentProviderEvent.update({
        where: { id: event.id },
        data: { status: PaymentProviderEventStatus.PROCESSED },
      });
      return NextResponse.json({ received: true, result: "processed", reason: providerStatus });
    }

    if (eventType !== "charge.success" || !payload.data) {
      await prisma.paymentProviderEvent.update({
        where: { id: event.id },
        data: { status: PaymentProviderEventStatus.IGNORED },
      });
      return NextResponse.json({ received: true, ignored: true });
    }

    const transactionData = payload.data as PaystackTransactionData;
    const creditResult = await settleCommunicationCreditPurchase(transactionData);
    const subscriptionResult = creditResult.status === "ignored" && creditResult.reason === "credit-purchase-not-found"
      ? await settleSubscriptionInvoicePayment(transactionData)
      : creditResult;
    const result = subscriptionResult.status === "ignored" && subscriptionResult.reason === "subscription-payment-not-found"
      ? await settlePaystackTransaction(transactionData)
      : subscriptionResult;
    await prisma.paymentProviderEvent.update({
      where: { id: event.id },
      data: {
        status: result.status === "processed"
          ? PaymentProviderEventStatus.PROCESSED
          : result.status === "failed"
            ? PaymentProviderEventStatus.FAILED
            : PaymentProviderEventStatus.IGNORED,
      },
    });
    return NextResponse.json({ received: true, result: result.status, reason: result.reason });
  } catch {
    await prisma.paymentProviderEvent.update({
      where: { id: event.id },
      data: { status: PaymentProviderEventStatus.FAILED },
    }).catch(() => undefined);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
