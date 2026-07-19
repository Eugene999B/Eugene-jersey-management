"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NotificationChannel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { sendCustomerMessage } from "@/lib/messaging";

const messageSchema = z.object({
  customerId: z.string().optional(),
  channel: z.nativeEnum(NotificationChannel),
  recipientPhone: z.string().optional(),
  recipientEmail: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().min(2).max(700),
});

export async function sendMessageAction(formData: FormData) {
  const session = await requireRole(permissions.messages);
  if (!session.shopId) redirect("/login");

  const parsed = messageSchema.safeParse({
    customerId: formData.get("customerId") || undefined,
    channel: formData.get("channel"),
    recipientPhone: formData.get("recipientPhone") || undefined,
    recipientEmail: formData.get("recipientEmail") || undefined,
    subject: formData.get("subject") || undefined,
    body: formData.get("body"),
  });
  if (!parsed.success) redirect("/dashboard/messages?error=invalid");

  const customer = parsed.data.customerId
    ? await prisma.customer.findFirst({ where: { id: parsed.data.customerId, shopId: session.shopId } })
    : null;

  await sendCustomerMessage({
    shopId: session.shopId,
    customerId: customer?.id,
    channel: parsed.data.channel,
    recipientName: customer?.name,
    recipientPhone: parsed.data.recipientPhone ?? customer?.phone,
    recipientEmail: parsed.data.recipientEmail ?? customer?.email,
    subject: parsed.data.subject,
    body: parsed.data.body,
    metadata: { sentBy: session.id },
  });

  await audit({
    shopId: session.shopId,
    userId: session.id,
    action: "message.sent",
    entityType: "CustomerMessage",
    metadata: { channel: parsed.data.channel, customerId: customer?.id ?? null },
  });

  revalidatePath("/dashboard/messages");
}
