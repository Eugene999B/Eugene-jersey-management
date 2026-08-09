"use server";

import { createHash } from "node:crypto";
import {
  CustomerProductionEventType,
  CustomerProductionRequestStatus,
  DeliveryStatus,
  FulfillmentType,
  OrderChannel,
  OrderStatus,
} from "@prisma/client";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getBuyerSession } from "@/lib/buyer-session";
import {
  customerArtworkBytesMatchMime,
  customerArtworkMimeAllowed,
  jsonSnapshot,
  MAX_CUSTOMER_ARTWORK_BYTES,
} from "@/lib/customer-production";
import { prisma } from "@/lib/db";

async function buyerRequest(requestId: string) {
  const buyer = await getBuyerSession();
  if (!buyer) redirect(`/buyer/login?next=${encodeURIComponent(`/buyer/production-requests/${requestId}`)}`);
  const request = await prisma.customerProductionRequest.findFirst({ where: { id: requestId, buyerId: buyer.id } });
  if (!request) redirect("/shops?error=request-not-found");
  return { buyer, request };
}

export async function approveCustomerProductionPreviewAction(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "");
  if (!requestId) redirect("/shops?error=request");
  const { buyer, request } = await buyerRequest(requestId);
  if (request.status !== CustomerProductionRequestStatus.PREVIEW_READY || request.quotedTotal === null || request.depositAmount === null || !request.previewSvg) {
    redirect(`/buyer/production-requests/${request.id}?error=not-ready`);
  }

  const buyerAccount = await prisma.buyerAccount.findUnique({ where: { id: buyer.id } });
  if (!buyerAccount?.isActive) redirect(`/buyer/login?next=${encodeURIComponent(`/buyer/production-requests/${request.id}`)}`);
  const variant = await prisma.productVariant.findFirst({ where: { id: request.productVariantId, product: { shopId: request.shopId } }, include: { product: true } });
  if (!variant) redirect(`/buyer/production-requests/${request.id}?error=product`);
  const shop = await prisma.shop.findUnique({ where: { id: request.shopId } });
  if (!shop?.isActive) redirect(`/buyer/production-requests/${request.id}?error=shop`);

  const order = await prisma.$transaction(async (tx) => {
    const locked = await tx.customerProductionRequest.findFirst({ where: { id: request.id, buyerId: buyer.id } });
    if (!locked || locked.status !== CustomerProductionRequestStatus.PREVIEW_READY || locked.quotedTotal === null || locked.depositAmount === null) throw new Error("REQUEST_CHANGED");
    if (locked.orderId) return tx.order.findUniqueOrThrow({ where: { id: locked.orderId } });

    const existingCustomer = await tx.customer.findFirst({ where: { shopId: locked.shopId, OR: [{ phone: buyerAccount.phone }, ...(buyerAccount.email ? [{ email: buyerAccount.email }] : [])] } });
    const customer = existingCustomer
      ? await tx.customer.update({ where: { id: existingCustomer.id }, data: { name: buyerAccount.name, phone: buyerAccount.phone, email: buyerAccount.email } })
      : await tx.customer.create({ data: { shopId: locked.shopId, name: buyerAccount.name, phone: buyerAccount.phone, email: buyerAccount.email, group: "Custom production" } });
    const total = Number(locked.quotedTotal);
    const created = await tx.order.create({
      data: {
        shopId: locked.shopId,
        customerId: customer.id,
        buyerId: buyer.id,
        status: OrderStatus.PENDING,
        channel: OrderChannel.ONLINE,
        totalAmount: total,
        notes: `Custom production request ${locked.id}. ${locked.requestNotes ?? ""}`.trim(),
        receiptNumber: `CUSTOM-${Date.now().toString().slice(-8)}-${nanoid(4).toUpperCase()}`,
        publicAccessToken: nanoid(32),
        idempotencyKey: `custom-request:${locked.id}`,
        fulfillmentType: locked.fulfillmentType,
        deliveryStatus: locked.fulfillmentType === FulfillmentType.DELIVERY ? DeliveryStatus.REQUESTED : DeliveryStatus.NOT_REQUIRED,
        deliveryAddress: locked.deliveryAddress,
        deliveryCity: locked.deliveryCity,
        deliveryArea: locked.deliveryArea,
        deliveryNotes: locked.deliveryNotes,
        items: {
          create: {
            productVariantId: locked.productVariantId,
            quantity: 1,
            unitPrice: total,
            personalizationData: jsonSnapshot({
              customerProductionRequestId: locked.id,
              garmentResourceId: locked.garmentResourceId,
              garmentSize: locked.garmentSize,
              placementResourceId: locked.placementResourceId,
              requestedText: locked.requestedText ?? "",
              requestedNumber: locked.requestedNumber ?? "",
              previewVersion: locked.previewVersion,
            }),
          },
        },
      },
    });
    await tx.customerProductionRequest.update({ where: { id: locked.id }, data: { status: CustomerProductionRequestStatus.APPROVED, approvedAt: new Date(), orderId: created.id } });
    await tx.customerProductionEvent.createMany({ data: [
      { shopId: locked.shopId, requestId: locked.id, type: CustomerProductionEventType.APPROVED, note: `Buyer approved preview version ${locked.previewVersion}.`, actorBuyerId: buyer.id },
      { shopId: locked.shopId, requestId: locked.id, type: CustomerProductionEventType.ORDER_CREATED, note: `Order ${created.receiptNumber} created after preview approval.`, metadata: { orderId: created.id, quotedTotal: total, depositAmount: Number(locked.depositAmount) }, actorBuyerId: buyer.id },
    ] });
    return created;
  }).catch(() => null);
  if (!order) redirect(`/buyer/production-requests/${request.id}?error=changed`);
  revalidatePath(`/buyer/production-requests/${request.id}`);
  redirect(`/buyer/production-requests/${request.id}?approved=1`);
}

const changesSchema = z.object({ requestId: z.string().min(1).max(160), note: z.string().trim().min(3).max(1200) });

export async function requestCustomerProductionChangesAction(formData: FormData) {
  const parsed = changesSchema.safeParse({ requestId: formData.get("requestId"), note: formData.get("note") });
  if (!parsed.success) redirect(`/buyer/production-requests/${String(formData.get("requestId") ?? "")}?error=changes`);
  const { buyer, request } = await buyerRequest(parsed.data.requestId);
  if (![CustomerProductionRequestStatus.PREVIEW_READY, CustomerProductionRequestStatus.QUOTED].includes(request.status)) redirect(`/buyer/production-requests/${request.id}?error=not-ready`);
  await prisma.$transaction(async (tx) => {
    const changed = await tx.customerProductionRequest.updateMany({
      where: { id: request.id, buyerId: buyer.id, status: { in: [CustomerProductionRequestStatus.PREVIEW_READY, CustomerProductionRequestStatus.QUOTED] } },
      data: { status: CustomerProductionRequestStatus.CHANGES_REQUESTED },
    });
    if (changed.count !== 1) throw new Error("REQUEST_CHANGED");
    await tx.customerProductionEvent.create({ data: { shopId: request.shopId, requestId: request.id, type: CustomerProductionEventType.CHANGES_REQUESTED, note: parsed.data.note, actorBuyerId: buyer.id } });
  }).catch(() => redirect(`/buyer/production-requests/${request.id}?error=changed`));
  revalidatePath(`/buyer/production-requests/${request.id}`);
}

export async function attachCustomerProductionArtworkAction(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "");
  if (!requestId) redirect("/shops?error=request");
  const { buyer, request } = await buyerRequest(requestId);
  if ([CustomerProductionRequestStatus.COMPLETED, CustomerProductionRequestStatus.CANCELLED].includes(request.status)) redirect(`/buyer/production-requests/${request.id}?error=closed`);
  const artwork = formData.get("artwork");
  if (!(artwork instanceof File) || artwork.size <= 0 || artwork.size > MAX_CUSTOMER_ARTWORK_BYTES || !customerArtworkMimeAllowed(artwork.type)) redirect(`/buyer/production-requests/${request.id}?error=artwork`);
  const bytes = new Uint8Array(await artwork.arrayBuffer());
  if (!customerArtworkBytesMatchMime(bytes, artwork.type)) redirect(`/buyer/production-requests/${request.id}?error=artwork-signature`);
  const count = await prisma.customerProductionAsset.count({ where: { shopId: request.shopId, requestId: request.id, buyerId: buyer.id } });
  if (count >= 6) redirect(`/buyer/production-requests/${request.id}?error=artwork-limit`);
  await prisma.$transaction(async (tx) => {
    const asset = await tx.customerProductionAsset.create({
      data: {
        shopId: request.shopId,
        requestId: request.id,
        buyerId: buyer.id,
        originalName: artwork.name.slice(0, 240) || "customer-artwork",
        mimeType: artwork.type.toLowerCase(),
        byteLength: bytes.byteLength,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        data: bytes,
      },
    });
    await tx.customerProductionEvent.create({ data: { shopId: request.shopId, requestId: request.id, type: CustomerProductionEventType.ARTWORK_ATTACHED, note: asset.originalName, metadata: { assetId: asset.id, mimeType: asset.mimeType, byteLength: asset.byteLength }, actorBuyerId: buyer.id } });
  });
  revalidatePath(`/buyer/production-requests/${request.id}`);
}
