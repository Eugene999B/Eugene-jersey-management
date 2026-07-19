"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { audit } from "@/lib/audit";

const schema = z.object({
  receiptNumber: z.string().min(1),
  phone: z.string().min(8),
  reason: z.string().min(5).max(700),
});

export async function requestReturnAction(formData: FormData) {
  const parsed = schema.safeParse({
    receiptNumber: formData.get("receiptNumber"),
    phone: formData.get("phone"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) redirect("/shops");

  const order = await prisma.order.findFirst({
    where: { receiptNumber: parsed.data.receiptNumber },
    include: { buyer: true, customer: true },
  });
  if (!order) redirect(`/track/${parsed.data.receiptNumber}?return=failed`);

  const expectedPhone = normalizePhone(order.buyer?.phone ?? order.customer?.phone ?? "");
  if (!expectedPhone || expectedPhone !== normalizePhone(parsed.data.phone)) {
    redirect(`/track/${parsed.data.receiptNumber}?return=failed`);
  }

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
  redirect(`/track/${order.receiptNumber}?return=success`);
}
