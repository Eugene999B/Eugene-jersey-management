"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { DeliveryStatus, FulfillmentType, OrderStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import { audit } from "@/lib/audit";
import { getBuyerSession } from "@/lib/buyer-session";
import { enforceRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  receiptNumber: z.string().min(1),
  accessToken: z.string().min(20),
  phone: z.string().min(8),
  code: z.string().regex(/^\d{6}$/),
});

function cleanPhone(value: string | null | undefined) {
  return String(value ?? "").replace(/[\s-]/g, "");
}

export async function verifyFulfillmentAction(formData: FormData) {
  const parsed = schema.safeParse({
    receiptNumber: formData.get("receiptNumber"),
    accessToken: formData.get("accessToken"),
    phone: formData.get("phone"),
    code: formData.get("code"),
  });

  if (!parsed.success) redirect("/shops");

  const order = await prisma.order.findFirst({
    where: { receiptNumber: parsed.data.receiptNumber },
    include: { buyer: true, customer: true, payments: true },
  });

  const buyer = await getBuyerSession();
  if (!order || (order.publicAccessToken !== parsed.data.accessToken && order.buyerId !== buyer?.id)) redirect("/shops");
  const trackingPath = `/track/${encodeURIComponent(order.receiptNumber)}?access=${encodeURIComponent(order.publicAccessToken)}`;
  if (order.fulfillmentType !== FulfillmentType.DELIVERY || order.status !== OrderStatus.READY) redirect(`${trackingPath}&verify=failed`);
  if (!order.payments.some((payment) => payment.status === "SUCCESS")) redirect(`${trackingPath}&verify=payment`);

  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || "unknown";
  try {
    await Promise.all([
      enforceRateLimit({ key: `fulfillment-order:${order.id}`, limit: 5, windowSeconds: 15 * 60 }),
      enforceRateLimit({ key: `fulfillment-ip:${ip}`, limit: 20, windowSeconds: 15 * 60 }),
    ]);
  } catch {
    redirect(`${trackingPath}&verify=rate`);
  }

  if (!order.pickupCodeHash || order.pickupCodeHash !== hashToken(parsed.data.code)) {
    redirect(`${trackingPath}&verify=failed`);
  }

  const expectedPhone = cleanPhone(order.buyer?.phone ?? order.customer?.phone);
  if (!expectedPhone || expectedPhone !== cleanPhone(parsed.data.phone)) {
    redirect(`${trackingPath}&verify=failed`);
  }

  const updated = await prisma.order.updateMany({
    where: { id: order.id, status: OrderStatus.READY, deliveryVerifiedAt: null },
    data: { deliveryStatus: DeliveryStatus.VERIFIED, deliveryVerifiedAt: new Date(), customerVerifiedAt: new Date(), status: OrderStatus.COMPLETED, pickupCodeHash: null, pickupCodeLast4: null },
  });
  if (updated.count !== 1) redirect(`${trackingPath}&verify=failed`);

  await audit({
    shopId: order.shopId,
    action: "public.delivery_verified",
    entityType: "Order",
    entityId: order.id,
    metadata: { receiptNumber: order.receiptNumber },
  });

  revalidatePath(`/track/${order.receiptNumber}`);
  redirect(`${trackingPath}&verify=success`);
}
