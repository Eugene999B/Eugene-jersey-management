import "server-only";

import { NotificationChannel, NotificationStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  creditChannelForNotification,
  refundCommunicationCredit,
  reserveCommunicationCredit,
} from "@/lib/communication-credits";

const PROVIDER_TIMEOUT_MS = Math.max(3_000, Math.min(30_000, Number(process.env.MESSAGE_PROVIDER_TIMEOUT_MS ?? 12_000)));

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

type ProviderMessageInput = Omit<SendMessageInput, "shopId" | "customerId"> & {
  shopId?: string | null;
  customerId?: string | null;
};

function providerConfig(channel: NotificationChannel) {
  if (channel === NotificationChannel.SMS) {
    return {
      provider: process.env.SMS_PROVIDER ?? "console",
      url: process.env.SMS_API_URL,
      token: process.env.SMS_API_TOKEN ?? process.env.ARKESEL_API_KEY,
      sender: process.env.SMS_SENDER_ID ?? process.env.ARKESEL_SENDER_ID ?? "Jersey",
    };
  }
  if (channel === NotificationChannel.WHATSAPP) {
    return {
      provider: process.env.WHATSAPP_PROVIDER ?? "console",
      url: process.env.WHATSAPP_API_URL,
      token: process.env.WHATSAPP_API_TOKEN,
      sender: process.env.WHATSAPP_SENDER_ID,
    };
  }
  return { provider: "console", url: undefined, token: undefined, sender: undefined };
}

export function isSmsDeliveryConfigured() {
  const config = providerConfig(NotificationChannel.SMS);
  if (config.provider.toLowerCase() === "arkesel") return Boolean(config.token && config.sender);
  return Boolean(config.url && config.token);
}

export function isCommunicationDeliveryConfigured(channel: NotificationChannel) {
  const config = providerConfig(channel);
  if (config.provider.toLowerCase() === "console") return false;
  if (channel === NotificationChannel.SMS && config.provider.toLowerCase() === "arkesel") {
    return Boolean(config.token && config.sender);
  }
  if (channel === NotificationChannel.SMS || channel === NotificationChannel.WHATSAPP) {
    return Boolean(config.url && config.token);
  }
  return false;
}

async function sendViaArkesel(input: ProviderMessageInput, token: string, sender: string) {
  const response = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
    method: "POST",
    headers: { "api-key": token, "Content-Type": "application/json" },
    body: JSON.stringify({ sender, message: input.body, recipients: [input.recipientPhone] }),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) return { status: NotificationStatus.FAILED, providerReference: `ARKESEL-${response.status}` };
  const payload = await response.json().catch(() => null) as { data?: { id?: string }; id?: string; reference?: string } | null;
  return { status: NotificationStatus.SENT, providerReference: payload?.data?.id ?? payload?.id ?? payload?.reference ?? "ARKESEL-SENT" };
}

async function sendViaGenericProvider(input: ProviderMessageInput) {
  const config = providerConfig(input.channel);
  const recipient = input.recipientPhone ?? input.recipientEmail;
  if (!recipient) return { status: NotificationStatus.FAILED, providerReference: "MISSING-RECIPIENT" };

  try {
    if (input.channel === NotificationChannel.SMS && config.provider.toLowerCase() === "arkesel" && config.token && input.recipientPhone) {
      return await sendViaArkesel(input, config.token, config.sender ?? "Jersey");
    }
    if (!config.url || !config.token) {
      console.warn(`[messaging] ${input.channel} provider is not configured; message queued without exposing recipient or content.`);
      return { status: NotificationStatus.QUEUED, providerReference: "CONSOLE-QUEUE" };
    }
    const response = await fetch(config.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: recipient, channel: input.channel, subject: input.subject, message: input.body, metadata: input.metadata }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) return { status: NotificationStatus.FAILED, providerReference: `HTTP-${response.status}` };
    const payload = await response.json().catch(() => null) as { id?: string; reference?: string } | null;
    return { status: NotificationStatus.SENT, providerReference: payload?.id ?? payload?.reference ?? "GENERIC-SENT" };
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return { status: NotificationStatus.FAILED, providerReference: timedOut ? "PROVIDER-TIMEOUT" : "PROVIDER-ERROR" };
  }
}

function sentByFromMetadata(metadata: Prisma.InputJsonValue | undefined) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const sentBy = (metadata as Record<string, unknown>).sentBy;
  return typeof sentBy === "string" ? sentBy : null;
}

export async function sendCustomerMessage(input: SendMessageInput) {
  const message = await prisma.customerMessage.create({
    data: {
      shopId: input.shopId,
      customerId: input.customerId ?? null,
      channel: input.channel,
      status: NotificationStatus.QUEUED,
      recipientName: input.recipientName ?? null,
      recipientPhone: input.recipientPhone ?? null,
      recipientEmail: input.recipientEmail ?? null,
      subject: input.subject ?? null,
      body: input.body,
      providerReference: "PENDING-DISPATCH",
      metadata: input.metadata ?? {},
    },
  });

  const creditChannel = creditChannelForNotification(input.channel);
  const chargeable = Boolean(creditChannel && isCommunicationDeliveryConfigured(input.channel));
  let reserved = false;
  if (creditChannel && chargeable) {
    const reservation = await reserveCommunicationCredit({
      shopId: input.shopId,
      channel: creditChannel,
      customerMessageId: message.id,
      createdById: sentByFromMetadata(input.metadata),
      metadata: { notificationChannel: input.channel },
    });
    if (!reservation.reserved) {
      return prisma.customerMessage.update({
        where: { id: message.id },
        data: { status: NotificationStatus.FAILED, providerReference: "INSUFFICIENT-CREDITS" },
      });
    }
    reserved = true;
  }

  const result = await sendViaGenericProvider(input);
  const updated = await prisma.customerMessage.update({
    where: { id: message.id },
    data: { status: result.status, providerReference: result.providerReference },
  });

  if (reserved && creditChannel && result.status === NotificationStatus.FAILED) {
    await refundCommunicationCredit({
      shopId: input.shopId,
      channel: creditChannel,
      customerMessageId: message.id,
      reason: `Refunded one ${creditChannel} credit because the provider did not accept the message.`,
      metadata: { providerReference: result.providerReference },
    });
  }
  return updated;
}

export async function sendDirectMessage(input: ProviderMessageInput) {
  return sendViaGenericProvider(input);
}

export async function sendDirectSms(input: {
  recipientPhone: string;
  recipientName?: string | null;
  body: string;
  subject?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  return sendDirectMessage({
    channel: NotificationChannel.SMS,
    recipientPhone: input.recipientPhone,
    recipientName: input.recipientName,
    subject: input.subject,
    body: input.body,
    metadata: input.metadata,
  });
}
