"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DeliveryStatus, FulfillmentType, OrderStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import { audit } from "@/lib/audit";

const schema = z.object({
  receiptNumber: z.string().min(1),
  phone: z.string().min(8),
  code: z.string().min(4).max(8),
});

function cleanPhone(value: string | null | undefined) {
  return String(value ?? "").replace(/[\s-]/g, "");
}

export async function verifyFulfillmentAction(formData: FormData) {
  const parsed = schema.safeParse({
    receiptNumber: formData.get("receiptNumber"),
    phone: formData.get("phone"),
    code: formData.get("code"),
  });

  if (!parsed.success) redirect("/shops");

  const order = await prisma.order.findFirst({
    where: { receiptNumber: parsed.data.receiptNumber },
    include: { buyer: true, customer: true },
  });

  if (!order || !order.pickupCodeHash || order.pickupCodeHash !== hashToken(parsed.data.code)) {
    redirect(`/track/${parsed.data.receiptNumber}?verify=failed`);
  }

  const expectedPhone = cleanPhone(order.buyer?.phone ?? order.customer?.phone);
  if (!expectedPhone || expectedPhone !== cleanPhone(parsed.data.phone)) {
    redirect(`/track/${parsed.data.receiptNumber}?verify=failed`);
  }

  const fulfillmentData = order.fulfillmentType === FulfillmentType.DELIVERY
    ? {
        deliveryStatus: DeliveryStatus.VERIFIED,
        deliveryVerifiedAt: new Date(),
        customerVerifiedAt: new Date(),
      }
    : {
        pickupVerifiedAt: new Date(),
        customerVerifiedAt: new Date(),
        status: order.status === OrderStatus.READY ? OrderStatus.COMPLETED : order.status,
      };

  await prisma.order.update({
    where: { id: order.id },
    data: fulfillmentData,
  });

  await audit({
    shopId: order.shopId,
    action: order.fulfillmentType === FulfillmentType.DELIVERY ? "public.delivery_verified" : "public.pickup_verified",
    entityType: "Order",
    entityId: order.id,
    metadata: { receiptNumber: order.receiptNumber },
  });

  revalidatePath(`/track/${order.receiptNumber}`);
  redirect(`/track/${order.receiptNumber}?verify=success`);
}
