"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { audit } from "@/lib/audit";
import { getBuyerSession } from "@/lib/buyer-session";
import { enforceRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  receiptNumber: z.string().min(1),
  accessToken: z.string().min(20),
  phone: z.string().min(8),
  reason: z.string().min(5).max(700),
});

export async function requestReturnAction(formData: FormData) {
  const parsed = schema.safeParse({
    receiptNumber: formData.get("receiptNumber"),
    accessToken: formData.get("accessToken"),
    phone: formData.get("phone"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) redirect("/shops");

  const order = await prisma.order.findFirst({
    where: { receiptNumber: parsed.data.receiptNumber },
    include: { buyer: true, customer: true },
  });
  const buyer = await getBuyerSession();
  if (!order || (order.publicAccessToken !== parsed.data.accessToken && order.buyerId !== buyer?.id)) redirect("/shops");
  const trackingPath = `/track/${encodeURIComponent(order.receiptNumber)}?access=${encodeURIComponent(order.publicAccessToken)}`;

  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || "unknown";
  try {
    await Promise.all([
      enforceRateLimit({ key: `return-order:${order.id}`, limit: 3, windowSeconds: 24 * 60 * 60 }),
      enforceRateLimit({ key: `return-ip:${ip}`, limit: 12, windowSeconds: 24 * 60 * 60 }),
    ]);
  } catch {
    redirect(`${trackingPath}&return=failed`);
  }

  const completedAt = order.customerVerifiedAt ?? order.updatedAt;
  const returnDeadline = new Date(completedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (order.status !== "COMPLETED" || returnDeadline < new Date()) redirect(`${trackingPath}&return=failed`);

  const expectedPhone = normalizePhone(order.buyer?.phone ?? order.customer?.phone ?? "");
  if (!expectedPhone || expectedPhone !== normalizePhone(parsed.data.phone)) {
    redirect(`${trackingPath}&return=failed`);
  }

  const openRequest = await prisma.returnRequest.findFirst({
    where: { orderId: order.id, status: { in: ["REQUESTED", "APPROVED", "RECEIVED"] } },
    select: { id: true },
  });
  if (openRequest) redirect(`${trackingPath}&return=success`);

  const request = await prisma.returnRequest.create({
    data: {
      shopId: order.shopId,
      orderId: order.id,
      buyerId: order.buyerId,
      reason: parsed.data.reason,
    },
  });

  await audit({
    shopId: order.shopId,
    action: "public.return_requested",
    entityType: "ReturnRequest",
    entityId: request.id,
    metadata: { receiptNumber: order.receiptNumber },
  });

  revalidatePath(`/track/${order.receiptNumber}`);
  redirect(`${trackingPath}&return=success`);
}
