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
  name: z.string().trim().min(2).max(80),
  city: z.string().trim().max(100).optional(),
  area: z.string().trim().max(100).optional(),
  fee: z.coerce.number().min(0).max(100_000_000).default(0),
  estimatedMins: z.coerce.number().int().min(1).max(10080).optional(),
});

const couponSchema = z.object({
  code: z.string().trim().min(2).max(32).regex(/^[A-Z0-9][A-Z0-9_-]*$/),
  discountType: z.nativeEnum(CouponDiscountType),
  value: z.coerce.number().positive().max(100_000_000),
  minSubtotal: z.coerce.number().min(0).max(100_000_000).optional(),
  usageLimit: z.coerce.number().int().min(1).max(1_000_000).optional(),
  endsAt: z.coerce.date().optional(),
}).superRefine((value, context) => {
  if (value.discountType === CouponDiscountType.PERCENT && value.value > 100) {
    context.addIssue({ code: "custom", path: ["value"], message: "Percentage discounts cannot exceed 100%." });
  }
});

const supportedReturnStatuses = new Set<ReturnRequestStatus>([
  ReturnRequestStatus.REQUESTED,
  ReturnRequestStatus.APPROVED,
  ReturnRequestStatus.RECEIVED,
  ReturnRequestStatus.REJECTED,
  ReturnRequestStatus.CANCELLED,
]);
const allowedReturnTransitions: Record<ReturnRequestStatus, ReturnRequestStatus[]> = {
  REQUESTED: [ReturnRequestStatus.APPROVED, ReturnRequestStatus.REJECTED, ReturnRequestStatus.CANCELLED],
  APPROVED: [ReturnRequestStatus.RECEIVED, ReturnRequestStatus.REJECTED, ReturnRequestStatus.CANCELLED],
  RECEIVED: [],
  REFUNDED: [],
  EXCHANGED: [],
  REJECTED: [],
  CANCELLED: [],
};
const returnSchema = z.object({
  requestId: z.string().min(1).max(100),
  status: z.nativeEnum(ReturnRequestStatus).refine((status) => supportedReturnStatuses.has(status)),
  resolution: z.string().trim().max(1000).optional(),
});

export async function createDeliveryZoneAction(formData: FormData) {
  const session = await requireRole(permissions.commerce);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  const shopId = session.shopId;

  const parsed = zoneSchema.safeParse({
    name: formData.get("name"),
    city: formData.get("city") || undefined,
    area: formData.get("area") || undefined,
    fee: formData.get("fee") || 0,
    estimatedMins: formData.get("estimatedMins") || undefined,
  });
  if (!parsed.success) redirect("/dashboard/commerce?error=zone");

  const zone = await prisma.deliveryZone.upsert({
    where: { shopId_name: { shopId, name: parsed.data.name } },
    create: { shopId, ...parsed.data },
    update: {
      city: parsed.data.city,
      area: parsed.data.area,
      fee: parsed.data.fee,
      estimatedMins: parsed.data.estimatedMins,
      isActive: true,
    },
  });

  await audit({
    shopId,
    userId: session.id,
    action: "commerce.delivery_zone_saved",
    entityType: "DeliveryZone",
    entityId: zone.id,
  });
  revalidatePath("/dashboard/commerce");
}

export async function createCouponAction(formData: FormData) {
  const session = await requireRole(permissions.commerce);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  const shopId = session.shopId;

  const parsed = couponSchema.safeParse({
    code: String(formData.get("code") ?? "").trim().toUpperCase(),
    discountType: formData.get("discountType"),
    value: formData.get("value"),
    minSubtotal: formData.get("minSubtotal") || undefined,
    usageLimit: formData.get("usageLimit") || undefined,
    endsAt: formData.get("endsAt") || undefined,
  });
  if (!parsed.success) redirect("/dashboard/commerce?error=coupon");

  const existing = await prisma.coupon.findUnique({
    where: { shopId_code: { shopId, code: parsed.data.code } },
    select: { usedCount: true },
  });
  if (parsed.data.usageLimit && existing && parsed.data.usageLimit < existing.usedCount) {
    redirect("/dashboard/commerce?error=coupon-usage-limit");
  }

  const coupon = await prisma.coupon.upsert({
    where: { shopId_code: { shopId, code: parsed.data.code } },
    create: {
      shopId,
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
    shopId,
    userId: session.id,
    action: "commerce.coupon_saved",
    entityType: "Coupon",
    entityId: coupon.id,
    metadata: { code: coupon.code, usageLimit: coupon.usageLimit },
  });
  revalidatePath("/dashboard/commerce");
}

export async function updateReturnRequestAction(formData: FormData) {
  const session = await requireRole(permissions.commerce);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  const shopId = session.shopId;

  const parsed = returnSchema.safeParse({
    requestId: formData.get("requestId"),
    status: formData.get("status"),
    resolution: formData.get("resolution") || undefined,
  });
  if (!parsed.success) redirect("/dashboard/commerce?error=return-workflow");

  const existing = await prisma.returnRequest.findFirst({
    where: { id: parsed.data.requestId, shopId },
  });
  if (!existing) redirect("/dashboard/commerce?error=return");
  if (parsed.data.status !== existing.status && !allowedReturnTransitions[existing.status].includes(parsed.data.status)) {
    redirect("/dashboard/commerce?error=return-transition");
  }

  const terminal = parsed.data.status === ReturnRequestStatus.REJECTED || parsed.data.status === ReturnRequestStatus.CANCELLED;
  const changed = await prisma.returnRequest.updateMany({
    where: { id: existing.id, shopId, status: existing.status },
    data: {
      status: parsed.data.status,
      resolution: parsed.data.resolution ?? existing.resolution,
      resolvedAt: terminal ? existing.resolvedAt ?? new Date() : null,
    },
  });
  if (changed.count !== 1) redirect("/dashboard/commerce?error=return-changed");

  await audit({
    shopId,
    userId: session.id,
    action: "commerce.return_request_updated",
    entityType: "ReturnRequest",
    entityId: existing.id,
    metadata: { from: existing.status, to: parsed.data.status },
  });
  revalidatePath("/dashboard/commerce");
}
