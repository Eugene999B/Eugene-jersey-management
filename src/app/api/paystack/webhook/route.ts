import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { PaymentProviderEventStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { settlePaystackTransaction, verifyPaystackWebhookSignature, type PaystackTransactionData } from "@/lib/payments";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");
  if (!verifyPaystackWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload: { event?: string; data?: PaystackTransactionData };
  try {
    payload = JSON.parse(rawBody) as { event?: string; data?: PaystackTransactionData };
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const eventType = payload.event ?? "unknown";
  const reference = payload.data?.reference ?? null;
  const eventId = String(payload.data?.id ?? createHash("sha256").update(rawBody).digest("hex"));
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
    if (eventType !== "charge.success" || !payload.data) {
      await prisma.paymentProviderEvent.update({
        where: { id: event.id },
        data: { status: PaymentProviderEventStatus.IGNORED },
      });
      return NextResponse.json({ received: true, ignored: true });
    }

    const result = await settlePaystackTransaction(payload.data);
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
