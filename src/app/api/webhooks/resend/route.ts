import { Prisma } from "@prisma/client";
import { applyEmailDeliveryEvent } from "@/lib/password-recovery";
import { platformDb } from "@/lib/platform-db";
import {
  parseResendWebhookPayload,
  verifyResendWebhookSignature,
} from "@/lib/resend-webhook";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) return new Response("Webhook unavailable", { status: 503 });

  const rawPayload = await request.text();
  const webhookHeaders = {
    id: request.headers.get("svix-id") ?? "",
    timestamp: request.headers.get("svix-timestamp") ?? "",
    signature: request.headers.get("svix-signature") ?? "",
  };
  if (!verifyResendWebhookSignature({ payload: rawPayload, headers: webhookHeaders, secret })) {
    return new Response("Invalid webhook", { status: 400 });
  }

  const event = parseResendWebhookPayload(rawPayload);
  if (!event) return new Response("Invalid payload", { status: 400 });

  if (event.providerReference) {
    await applyEmailDeliveryEvent({
      providerReference: event.providerReference,
      eventType: event.eventType,
      detail: event.detail,
      occurredAt: event.occurredAt,
    });
  }

  try {
    await platformDb.emailProviderEvent.create({
      data: {
        provider: "resend",
        eventId: webhookHeaders.id,
        eventType: event.eventType,
        providerReference: event.providerReference,
        occurredAt: event.occurredAt,
        payload: event.safePayload as Prisma.InputJsonObject,
      },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
  }

  return Response.json({ received: true });
}