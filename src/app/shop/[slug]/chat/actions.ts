"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getBuyerSession } from "@/lib/buyer-session";
import { enforceRateLimit } from "@/lib/rate-limit";

const chatSchema = z.object({
  shopSlug: z.string().min(1),
  subject: z.string().min(2).max(100),
  body: z.string().min(2).max(1000),
});

export async function startCustomerChatAction(formData: FormData) {
  const parsed = chatSchema.safeParse({
    shopSlug: formData.get("shopSlug"),
    subject: formData.get("subject"),
    body: formData.get("body"),
  });

  if (!parsed.success) redirect(`/shop/${String(formData.get("shopSlug") ?? "")}/chat?error=invalid`);

  const buyer = await getBuyerSession();
  if (!buyer) redirect(`/buyer/login?next=${encodeURIComponent(`/shop/${parsed.data.shopSlug}/chat`)}&error=login-required`);
  try {
    await enforceRateLimit({ key: `buyer-chat:${buyer.id}:${parsed.data.shopSlug}`, limit: 10, windowSeconds: 60 * 60 });
  } catch {
    redirect(`/shop/${parsed.data.shopSlug}/chat?error=rate`);
  }

  const shop = await prisma.shop.findUnique({ where: { slug: parsed.data.shopSlug } });
  if (!shop || !shop.isActive || !shop.storefrontEnabled) redirect(`/shop/${parsed.data.shopSlug}/chat?error=closed`);

  const existingCustomer = await prisma.customer.findFirst({
    where: { shopId: shop.id, OR: [{ phone: buyer.phone }, ...(buyer.email ? [{ email: buyer.email }] : [])] },
  });
  const customer = existingCustomer
    ? await prisma.customer.update({ where: { id: existingCustomer.id }, data: { name: buyer.name, phone: buyer.phone, email: buyer.email } })
    : await prisma.customer.create({ data: { shopId: shop.id, name: buyer.name, phone: buyer.phone, email: buyer.email, group: "Portal" } });

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
