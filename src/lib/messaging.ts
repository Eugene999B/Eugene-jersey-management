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

async function sendViaArkesel(input: ProviderMessageInput, token: string, sender: string) {
  const response = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
    method: "POST",
    headers: {
      "api-key": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender,
      message: input.body,
      recipients: [input.recipientPhone],
    }),
  });

  if (!response.ok) {
    return { status: NotificationStatus.FAILED, providerReference: `ARKESEL-${response.status}` };
  }

  const payload = await response.json().catch(() => null) as { data?: { id?: string }; id?: string; reference?: string } | null;
  return {
    status: NotificationStatus.SENT,
    providerReference: payload?.data?.id ?? payload?.id ?? payload?.reference ?? "ARKESEL-SENT",
  };
}

async function sendViaGenericProvider(input: ProviderMessageInput) {
  const config = providerConfig(input.channel);
  if (input.channel === NotificationChannel.SMS && config.provider.toLowerCase() === "arkesel" && config.token && input.recipientPhone) {
    return sendViaArkesel(input, config.token, config.sender ?? "Jersey");
  }

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

export async function sendDirectSms(input: {
  recipientPhone: string;
  recipientName?: string | null;
  body: string;
  subject?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  return sendViaGenericProvider({
    channel: NotificationChannel.SMS,
    recipientPhone: input.recipientPhone,
    recipientName: input.recipientName,
    subject: input.subject,
    body: input.body,
    metadata: input.metadata,
  });
}
