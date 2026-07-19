"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CouponDiscountType, ReturnRequestStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";
import { audit } from "@/lib/audit";

const zoneSchema = z.object({
  name: z.string().min(2).max(80),
  city: z.string().optional(),
  area: z.string().optional(),
  fee: z.coerce.number().min(0).default(0),
  estimatedMins: z.coerce.number().int().min(1).optional(),
});

const couponSchema = z.object({
  code: z.string().min(2).max(32),
  discountType: z.nativeEnum(CouponDiscountType),
  value: z.coerce.number().positive(),
  minSubtotal: z.coerce.number().min(0).optional(),
  usageLimit: z.coerce.number().int().min(1).optional(),
  endsAt: z.coerce.date().optional(),
});

const returnSchema = z.object({
  requestId: z.string().min(1),
  status: z.nativeEnum(ReturnRequestStatus),
  resolution: z.string().optional(),
});

export async function createDeliveryZoneAction(formData: FormData) {
  const session = await requireRole(permissions.commerce);
  if (!session.shopId) redirect("/login");

  const parsed = zoneSchema.safeParse({
    name: formData.get("name"),
    city: formData.get("city") || undefined,
    area: formData.get("area") || undefined,
    fee: formData.get("fee") || 0,
    estimatedMins: formData.get("estimatedMins") || undefined,
  });
  if (!parsed.success) redirect("/dashboard/commerce?error=zone");

  const zone = await prisma.deliveryZone.upsert({
    where: { shopId_name: { shopId: session.shopId, name: parsed.data.name } },
    create: {
      shopId: session.shopId,
      name: parsed.data.name,
      city: parsed.data.city,
      area: parsed.data.area,
      fee: parsed.data.fee,
      estimatedMins: parsed.data.estimatedMins,
    },
    update: {
      city: parsed.data.city,
      area: parsed.data.area,
      fee: parsed.data.fee,
      estimatedMins: parsed.data.estimatedMins,
      isActive: true,
    },
  });

  await audit({
    shopId: session.shopId,
    userId: session.id,
    action: "commerce.delivery_zone_saved",
    entityType: "DeliveryZone",
    entityId: zone.id,
  });

  revalidatePath("/dashboard/commerce");
}

export async function createCouponAction(formData: FormData) {
  const session = await requireRole(permissions.commerce);
  if (!session.shopId) redirect("/login");

  const parsed = couponSchema.safeParse({
    code: String(formData.get("code") ?? "").toUpperCase(),
    discountType: formData.get("discountType"),
    value: formData.get("value"),
    minSubtotal: formData.get("minSubtotal") || undefined,
    usageLimit: formData.get("usageLimit") || undefined,
    endsAt: formData.get("endsAt") || undefined,
  });
  if (!parsed.success) redirect("/dashboard/commerce?error=coupon");

  const coupon = await prisma.coupon.upsert({
    where: { shopId_code: { shopId: session.shopId, code: parsed.data.code } },
    create: {
      shopId: session.shopId,
      code: parsed.data.code,
      discountType: parsed.data.discountType,
      value: parsed.data.value,
      minSubtotal: parsed.data.minSubtotal,
      usageLimit: parsed.data.usageLimit,
      endsAt: parsed.data.endsAt,
    },
    update: {
      discountType: parsed.data.discountType,
      value: parsed.data.value,
      minSubtotal: parsed.data.minSubtotal,
      usageLimit: parsed.data.usageLimit,
      endsAt: parsed.data.endsAt,
      status: "ACTIVE",
    },
  });

  await audit({
    shopId: session.shopId,
    userId: session.id,
    action: "commerce.coupon_saved",
    entityType: "Coupon",
    entityId: coupon.id,
    metadata: { code: coupon.code },
  });

  revalidatePath("/dashboard/commerce");
}

export async function updateReturnRequestAction(formData: FormData) {
  const session = await requireRole(permissions.commerce);
  if (!session.shopId) redirect("/login");

  const parsed = returnSchema.safeParse({
    requestId: formData.get("requestId"),
    status: formData.get("status"),
    resolution: formData.get("resolution") || undefined,
  });
  if (!parsed.success) redirect("/dashboard/commerce?error=return");

  const existing = await prisma.returnRequest.findFirst({
    where: { id: parsed.data.requestId, shopId: session.shopId },
  });
  if (!existing) redirect("/dashboard/commerce?error=return");

  const request = await prisma.returnRequest.update({
    where: { id: existing.id },
    data: {
      status: parsed.data.status,
      resolution: parsed.data.resolution,
      resolvedAt: ["REFUNDED", "EXCHANGED", "REJECTED", "CANCELLED"].includes(parsed.data.status) ? new Date() : undefined,
    },
  });

  await audit({
    shopId: session.shopId,
    userId: session.id,
    action: "commerce.return_request_updated",
    entityType: "ReturnRequest",
    entityId: request.id,
    metadata: { status: request.status },
  });

  revalidatePath("/dashboard/commerce");
}
