import { NotificationChannel, NotificationStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type SendMessageInput = {
  shopId: string;
  customerId?: string | null;
  channel: NotificationChannel;
  recipientName?: string | null;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
  subject?: string | null;
  body: string;
  metadata?: Prisma.InputJsonValue;
};

function providerConfig(channel: NotificationChannel) {
  if (channel === NotificationChannel.SMS) {
    return {
      url: process.env.SMS_API_URL,
      token: process.env.SMS_API_TOKEN,
    };
  }

  if (channel === NotificationChannel.WHATSAPP) {
    return {
      url: process.env.WHATSAPP_API_URL,
      token: process.env.WHATSAPP_API_TOKEN,
    };
  }

  return { url: undefined, token: undefined };
}

async function sendViaGenericProvider(input: SendMessageInput) {
  const config = providerConfig(input.channel);
  if (!config.url || !config.token) {
    console.log(`[${input.channel}] ${input.recipientPhone ?? input.recipientEmail ?? "unknown"}: ${input.body}`);
    return { status: NotificationStatus.QUEUED, providerReference: "CONSOLE-QUEUE" };
  }

  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: input.recipientPhone ?? input.recipientEmail,
      channel: input.channel,
      subject: input.subject,
      message: input.body,
      metadata: input.metadata,
    }),
  });

  if (!response.ok) {
    return { status: NotificationStatus.FAILED, providerReference: `HTTP-${response.status}` };
  }

  const payload = await response.json().catch(() => null) as { id?: string; reference?: string } | null;
  return {
    status: NotificationStatus.SENT,
    providerReference: payload?.id ?? payload?.reference ?? "GENERIC-SENT",
  };
}

export async function sendCustomerMessage(input: SendMessageInput) {
  const result = await sendViaGenericProvider(input);
  return prisma.customerMessage.create({
    data: {
      shopId: input.shopId,
      customerId: input.customerId ?? null,
      channel: input.channel,
      status: result.status,
      recipientName: input.recipientName ?? null,
      recipientPhone: input.recipientPhone ?? null,
      recipientEmail: input.recipientEmail ?? null,
      subject: input.subject ?? null,
      body: input.body,
      providerReference: result.providerReference,
      metadata: input.metadata ?? {},
    },
  });
}
