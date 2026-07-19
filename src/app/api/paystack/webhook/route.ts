import { NextRequest, NextResponse } from "next/server";
import { PaymentProviderEventStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { settlePaystackTransaction, verifyPaystackWebhookSignature, type PaystackTransactionData } from "@/lib/payments";
import { audit } from "@/lib/audit";

type PaystackWebhookPayload = {
  event?: string;
  data?: PaystackTransactionData;
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!verifyPaystackWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as PaystackWebhookPayload;
  const eventType = payload.event ?? "unknown";
  const reference = payload.data?.reference ?? null;
  const eventId = payload.data?.id ? String(payload.data.id) : `${eventType}:${reference ?? Date.now()}`;

  const event = await prisma.paymentProviderEvent.upsert({
    where: { provider_eventId: { provider: "paystack", eventId } },
    create: {
      provider: "paystack",
      eventType,
      eventId,
      reference,
      payload: payload as unknown as object,
    },
    update: {},
  });

  if (event.status === PaymentProviderEventStatus.PROCESSED || event.status === PaymentProviderEventStatus.IGNORED) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (eventType !== "charge.success" || !payload.data) {
    await prisma.paymentProviderEvent.update({
      where: { id: event.id },
      data: { status: PaymentProviderEventStatus.IGNORED, processedAt: new Date() },
    });
    return NextResponse.json({ received: true, ignored: true });
  }

  const result = await settlePaystackTransaction(payload.data);
  await prisma.paymentProviderEvent.update({
    where: { id: event.id },
    data: {
      status: result.status === "processed" ? PaymentProviderEventStatus.PROCESSED : PaymentProviderEventStatus.FAILED,
      processedAt: new Date(),
    },
  });

  if ("payment" in result && result.payment?.orderId) {
    const payment = await prisma.payment.findUnique({
      where: { id: result.payment.id },
      include: { order: true },
    });
    if (payment?.order) {
      await audit({
        shopId: payment.order.shopId,
        action: `paystack.webhook_${result.status}`,
        entityType: "Payment",
        entityId: payment.id,
        metadata: { reference, reason: result.reason, eventType },
      });
    }
  }

  return NextResponse.json({ received: true, status: result.status, reason: result.reason });
}
