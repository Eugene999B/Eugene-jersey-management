"use server";

import {
  CustomerProductionEventType,
  CustomerProductionRequestStatus,
  NotificationChannel,
  OrderStatus,
  Role,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { buildCustomerProductionPreview } from "@/lib/customer-production";
import { prisma } from "@/lib/db";
import { sendCustomerMessage } from "@/lib/messaging";

const productionRoles: Role[] = [Role.OWNER, Role.MANAGER, Role.DESIGNER];

function record(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function text(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }

const quoteSchema = z.object({
  requestId: z.string().min(1).max(160),
  quotedTotal: z.coerce.number().positive().max(100_000_000),
  depositAmount: z.coerce.number().min(0).max(100_000_000),
  previewNote: z.string().trim().min(3).max(1000),
  quoteExpiresAt: z.coerce.date().optional(),
});

export async function quoteCustomerProductionRequestAction(formData: FormData) {
  const session = await requireRole(productionRoles);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  const shopId = session.shopId;
  const parsed = quoteSchema.safeParse({
    requestId: formData.get("requestId"),
    quotedTotal: formData.get("quotedTotal"),
    depositAmount: formData.get("depositAmount") || 0,
    previewNote: formData.get("previewNote"),
    quoteExpiresAt: formData.get("quoteExpiresAt") || undefined,
  });
  if (!parsed.success || parsed.data.depositAmount > parsed.data.quotedTotal) redirect("/dashboard/customer-production?error=quote");
  const request = await prisma.customerProductionRequest.findFirst({ where: { id: parsed.data.requestId, shopId } });
  if (!request || ![CustomerProductionRequestStatus.SUBMITTED, CustomerProductionRequestStatus.QUOTED, CustomerProductionRequestStatus.PREVIEW_READY, CustomerProductionRequestStatus.CHANGES_REQUESTED].includes(request.status)) redirect("/dashboard/customer-production?error=state");
  const buyer = await prisma.buyerAccount.findUnique({ where: { id: request.buyerId } });
  if (!buyer?.isActive) redirect("/dashboard/customer-production?error=buyer");

  const garment = record(request.garmentSnapshot);
  const placement = record(request.placementSnapshot);
  const previewVersion = request.previewVersion + 1;
  const previewSvg = buildCustomerProductionPreview({
    title: request.title,
    garment: { name: text(garment.name, "Garment"), colour: text(garment.colour), garmentType: text(garment.garmentType, "Garment") },
    size: request.garmentSize,
    placement: { name: text(placement.name, "Placement"), location: text(placement.location, "CUSTOM") },
    requestedText: request.requestedText,
    requestedNumber: request.requestedNumber,
    previewNote: parsed.data.previewNote,
  });
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const changed = await tx.customerProductionRequest.updateMany({
      where: { id: request.id, shopId, status: request.status },
      data: {
        status: CustomerProductionRequestStatus.PREVIEW_READY,
        quotedTotal: parsed.data.quotedTotal,
        depositAmount: parsed.data.depositAmount,
        previewSvg,
        previewVersion,
        previewNote: parsed.data.previewNote,
        quoteExpiresAt: parsed.data.quoteExpiresAt,
        quotedAt: now,
        previewReadyAt: now,
      },
    });
    if (changed.count !== 1) throw new Error("REQUEST_CHANGED");
    await tx.customerProductionEvent.createMany({ data: [
      { shopId, requestId: request.id, type: CustomerProductionEventType.QUOTED, note: `Quote ${parsed.data.quotedTotal.toFixed(2)}; deposit ${parsed.data.depositAmount.toFixed(2)}.`, metadata: { quotedTotal: parsed.data.quotedTotal, depositAmount: parsed.data.depositAmount, quoteExpiresAt: parsed.data.quoteExpiresAt?.toISOString() ?? null }, actorUserId: session.id },
      { shopId, requestId: request.id, type: CustomerProductionEventType.PREVIEW_READY, note: `Preview version ${previewVersion} is ready for customer approval.`, actorUserId: session.id },
    ] });
  }).catch(() => redirect("/dashboard/customer-production?error=changed"));

  void sendCustomerMessage({
    shopId,
    channel: NotificationChannel.SMS,
    recipientName: buyer.name,
    recipientPhone: buyer.phone,
    recipientEmail: buyer.email,
    body: `${request.title}: preview v${previewVersion} and quote are ready. Login to ESM to approve or request changes.`,
    metadata: { customerProductionRequestId: request.id, notification: "preview-ready" },
  }).catch(() => undefined);
  await audit({ shopId, userId: session.id, action: "customer-production.preview-ready", entityType: "CustomerProductionRequest", entityId: request.id, metadata: { previewVersion, quotedTotal: parsed.data.quotedTotal, depositAmount: parsed.data.depositAmount } });
  revalidatePath("/dashboard/customer-production");
  revalidatePath(`/buyer/production-requests/${request.id}`);
}

const stageSchema = z.object({ requestId: z.string().min(1).max(160), action: z.enum(["START_PRODUCTION", "MARK_READY", "COMPLETE"]) });

export async function advanceCustomerProductionAction(formData: FormData) {
  const session = await requireRole(productionRoles);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  const shopId = session.shopId;
  const parsed = stageSchema.safeParse({ requestId: formData.get("requestId"), action: formData.get("action") });
  if (!parsed.success) redirect("/dashboard/customer-production?error=stage");
  const request = await prisma.customerProductionRequest.findFirst({ where: { id: parsed.data.requestId, shopId } });
  if (!request?.orderId) redirect("/dashboard/customer-production?error=order");
  const buyer = await prisma.buyerAccount.findUnique({ where: { id: request.buyerId } });

  let nextStatus: CustomerProductionRequestStatus;
  let orderStatus: OrderStatus;
  let eventType: CustomerProductionEventType;
  let timestampField: "productionStartedAt" | "readyAt" | "completedAt";
  if (parsed.data.action === "START_PRODUCTION") {
    if (request.status !== CustomerProductionRequestStatus.DEPOSIT_PAID || !request.depositPaidAt) redirect("/dashboard/customer-production?error=deposit");
    nextStatus = CustomerProductionRequestStatus.IN_PRODUCTION;
    orderStatus = OrderStatus.IN_PRODUCTION;
    eventType = CustomerProductionEventType.PRODUCTION_STARTED;
    timestampField = "productionStartedAt";
  } else if (parsed.data.action === "MARK_READY") {
    if (request.status !== CustomerProductionRequestStatus.IN_PRODUCTION) redirect("/dashboard/customer-production?error=production");
    nextStatus = CustomerProductionRequestStatus.READY;
    orderStatus = OrderStatus.READY;
    eventType = CustomerProductionEventType.READY;
    timestampField = "readyAt";
  } else {
    if (request.status !== CustomerProductionRequestStatus.READY) redirect("/dashboard/customer-production?error=ready");
    if (!request.balancePaidAt) redirect("/dashboard/customer-production?error=balance");
    nextStatus = CustomerProductionRequestStatus.COMPLETED;
    orderStatus = OrderStatus.COMPLETED;
    eventType = CustomerProductionEventType.COMPLETED;
    timestampField = "completedAt";
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const changed = await tx.customerProductionRequest.updateMany({
      where: { id: request.id, shopId, status: request.status },
      data: { status: nextStatus, [timestampField]: now },
    });
    if (changed.count !== 1) throw new Error("REQUEST_CHANGED");
    await tx.order.updateMany({ where: { id: request.orderId!, shopId }, data: { status: orderStatus, completedAt: orderStatus === OrderStatus.COMPLETED ? now : undefined } });
    await tx.customerProductionEvent.create({ data: { shopId, requestId: request.id, type: eventType, note: parsed.data.action === "START_PRODUCTION" ? "Production started after verified deposit." : parsed.data.action === "MARK_READY" ? "Custom production is ready for fulfilment." : "Custom production completed after full payment.", actorUserId: session.id } });
  }).catch(() => redirect("/dashboard/customer-production?error=changed"));

  if (buyer?.isActive && (parsed.data.action === "MARK_READY" || parsed.data.action === "COMPLETE")) {
    void sendCustomerMessage({
      shopId,
      channel: NotificationChannel.SMS,
      recipientName: buyer.name,
      recipientPhone: buyer.phone,
      recipientEmail: buyer.email,
      body: parsed.data.action === "MARK_READY"
        ? `${request.title} is ready. Login to ESM to see any remaining balance and fulfilment details.`
        : `${request.title} is completed. Thank you for your order.`,
      metadata: { customerProductionRequestId: request.id, notification: parsed.data.action === "MARK_READY" ? "ready" : "completed" },
    }).catch(() => undefined);
  }
  await audit({ shopId, userId: session.id, action: `customer-production.${parsed.data.action.toLowerCase().replaceAll("_", "-")}`, entityType: "CustomerProductionRequest", entityId: request.id, metadata: { nextStatus, orderStatus } });
  revalidatePath("/dashboard/customer-production");
  revalidatePath(`/buyer/production-requests/${request.id}`);
}
