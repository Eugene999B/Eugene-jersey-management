"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

const chatSchema = z.object({
  shopSlug: z.string().min(1),
  name: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  subject: z.string().min(2).max(100),
  body: z.string().min(2).max(1000),
});

export async function startCustomerChatAction(formData: FormData) {
  const parsed = chatSchema.safeParse({
    shopSlug: formData.get("shopSlug"),
    name: formData.get("name"),
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    subject: formData.get("subject"),
    body: formData.get("body"),
  });

  if (!parsed.success) redirect(`/shop/${String(formData.get("shopSlug") ?? "")}/chat?error=invalid`);

  const shop = await prisma.shop.findUnique({ where: { slug: parsed.data.shopSlug } });
  if (!shop || !shop.isActive || !shop.storefrontEnabled) redirect(`/shop/${parsed.data.shopSlug}/chat?error=closed`);

  const customer = await prisma.customer.create({
    data: {
      shopId: shop.id,
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email,
      group: "Portal",
    },
  });

  const thread = await prisma.customerThread.create({
    data: {
      shopId: shop.id,
      customerId: customer.id,
      subject: parsed.data.subject,
      messages: {
        create: {
          senderType: "CUSTOMER",
          senderName: customer.name,
          body: parsed.data.body,
        },
      },
    },
  });

  await audit({
    shopId: shop.id,
    action: "customer.chat_started",
    entityType: "CustomerThread",
    entityId: thread.id,
    metadata: { customerId: customer.id },
  });

  redirect(`/shop/${shop.slug}/chat?sent=1`);
}
