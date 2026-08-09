"use server";

import { createHash } from "node:crypto";
import { CustomerProductionEventType, FulfillmentType, OrderChannel } from "@prisma/client";
import { nanoid } from "nanoid";
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
import { readProductionLibrary } from "@/lib/production-specs";
import { assertOrderCreationAvailable, CommercialSubscriptionError } from "@/lib/subscription-hardening";

const requestSchema = z.object({
  shopSlug: z.string().trim().min(1).max(120),
  productVariantId: z.string().min(1).max(120),
  garmentSelection: z.string().min(3).max(240),
  placementResourceId: z.string().min(1).max(120),
  requestedText: z.string().trim().max(120).optional(),
  requestedNumber: z.string().trim().max(30).optional(),
  requestNotes: z.string().trim().max(1500).optional(),
  fulfillmentType: z.nativeEnum(FulfillmentType),
  deliveryAddress: z.string().trim().max(500).optional(),
  deliveryCity: z.string().trim().max(120).optional(),
  deliveryArea: z.string().trim().max(160).optional(),
  deliveryNotes: z.string().trim().max(500).optional(),
});

export async function submitCustomerProductionRequestAction(formData: FormData) {
  const parsed = requestSchema.safeParse({
    shopSlug: formData.get("shopSlug"),
    productVariantId: formData.get("productVariantId"),
    garmentSelection: formData.get("garmentSelection"),
    placementResourceId: formData.get("placementResourceId"),
    requestedText: formData.get("requestedText") || undefined,
    requestedNumber: formData.get("requestedNumber") || undefined,
    requestNotes: formData.get("requestNotes") || undefined,
    fulfillmentType: formData.get("fulfillmentType") || FulfillmentType.PICKUP,
    deliveryAddress: formData.get("deliveryAddress") || undefined,
    deliveryCity: formData.get("deliveryCity") || undefined,
    deliveryArea: formData.get("deliveryArea") || undefined,
    deliveryNotes: formData.get("deliveryNotes") || undefined,
  });
  const fallbackSlug = String(formData.get("shopSlug") ?? "");
  if (!parsed.success) redirect(`/shop/${encodeURIComponent(fallbackSlug)}/custom-production?error=invalid`);
  if (parsed.data.fulfillmentType === FulfillmentType.DELIVERY && !parsed.data.deliveryAddress) {
    redirect(`/shop/${encodeURIComponent(parsed.data.shopSlug)}/custom-production?error=delivery`);
  }

  const buyerSession = await getBuyerSession();
  if (!buyerSession) redirect(`/buyer/login?next=${encodeURIComponent(`/shop/${parsed.data.shopSlug}/custom-production`)}`);
  const buyer = await prisma.buyerAccount.findUnique({ where: { id: buyerSession.id } });
  if (!buyer?.isActive || buyer.phone !== buyerSession.phone) redirect(`/buyer/login?next=${encodeURIComponent(`/shop/${parsed.data.shopSlug}/custom-production`)}`);

  const shop = await prisma.shop.findUnique({ where: { slug: parsed.data.shopSlug } });
  if (!shop || !shop.isActive || !shop.storefrontEnabled || !shop.publicOrderingEnabled || !shop.enabledModules.includes("ONLINE_SELLING") || !shop.enabledModules.includes("PRINTING_PRODUCTION")) {
    redirect(`/shop/${parsed.data.shopSlug}?error=closed`);
  }
  try {
    await assertOrderCreationAvailable({ shopId: shop.id, channel: OrderChannel.ONLINE });
  } catch (error) {
    if (error instanceof CommercialSubscriptionError) redirect(`/shop/${shop.slug}/custom-production?error=subscription`);
    throw error;
  }

  const variant = await prisma.productVariant.findFirst({
    where: { id: parsed.data.productVariantId, product: { shopId: shop.id, isPersonalizable: true } },
    include: { product: { include: { category: true } } },
  });
  if (!variant) redirect(`/shop/${shop.slug}/custom-production?error=product`);

  const [garmentResourceId, garmentSize] = parsed.data.garmentSelection.split("::", 2);
  const library = readProductionLibrary(shop.productionSetup);
  const garment = library.garments.find((item) => item.id === garmentResourceId && item.isActive && item.sizes.includes(garmentSize));
  const placement = library.placements.find((item) => item.id === parsed.data.placementResourceId && item.isActive && (!item.garmentId || item.garmentId === garmentResourceId));
  if (!garment || !garmentSize || !placement) redirect(`/shop/${shop.slug}/custom-production?error=production-option`);

  const artwork = formData.get("artwork");
  let artworkData: { originalName: string; mimeType: string; byteLength: number; sha256: string; data: Uint8Array } | null = null;
  if (artwork instanceof File && artwork.size > 0) {
    if (!customerArtworkMimeAllowed(artwork.type) || artwork.size > MAX_CUSTOMER_ARTWORK_BYTES) redirect(`/shop/${shop.slug}/custom-production?error=artwork`);
    const bytes = new Uint8Array(await artwork.arrayBuffer());
    if (!customerArtworkBytesMatchMime(bytes, artwork.type)) redirect(`/shop/${shop.slug}/custom-production?error=artwork-signature`);
    artworkData = {
      originalName: artwork.name.slice(0, 240) || "customer-artwork",
      mimeType: artwork.type.toLowerCase(),
      byteLength: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      data: bytes,
    };
  }

  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.customerProductionRequest.create({
      data: {
        shopId: shop.id,
        buyerId: buyer.id,
        productVariantId: variant.id,
        publicAccessToken: nanoid(36),
        title: `${variant.product.name} · ${garment.name} ${garmentSize}`.slice(0, 180),
        productSnapshot: jsonSnapshot({
          productId: variant.product.id,
          productName: variant.product.name,
          category: variant.product.category.name,
          sku: variant.sku,
          variantAttributes: variant.attributes,
          listedPrice: Number(variant.priceOverride ?? variant.product.basePrice),
        }),
        garmentResourceId: garment.id,
        garmentSnapshot: jsonSnapshot(garment),
        garmentSize,
        placementResourceId: placement.id,
        placementSnapshot: jsonSnapshot(placement),
        requestedText: parsed.data.requestedText,
        requestedNumber: parsed.data.requestedNumber,
        requestNotes: parsed.data.requestNotes,
        fulfillmentType: parsed.data.fulfillmentType,
        deliveryAddress: parsed.data.fulfillmentType === FulfillmentType.DELIVERY ? parsed.data.deliveryAddress : null,
        deliveryCity: parsed.data.fulfillmentType === FulfillmentType.DELIVERY ? parsed.data.deliveryCity : null,
        deliveryArea: parsed.data.fulfillmentType === FulfillmentType.DELIVERY ? parsed.data.deliveryArea : null,
        deliveryNotes: parsed.data.fulfillmentType === FulfillmentType.DELIVERY ? parsed.data.deliveryNotes : null,
      },
    });
    await tx.customerProductionEvent.create({
      data: { shopId: shop.id, requestId: created.id, type: CustomerProductionEventType.SUBMITTED, note: "Customer submitted a custom production request.", actorBuyerId: buyer.id },
    });
    if (artworkData) {
      await tx.customerProductionAsset.create({ data: { shopId: shop.id, requestId: created.id, buyerId: buyer.id, ...artworkData } });
      await tx.customerProductionEvent.create({
        data: { shopId: shop.id, requestId: created.id, type: CustomerProductionEventType.ARTWORK_ATTACHED, note: artworkData.originalName, metadata: { mimeType: artworkData.mimeType, byteLength: artworkData.byteLength, sha256: artworkData.sha256 }, actorBuyerId: buyer.id },
      });
    }
    return created;
  });

  redirect(`/buyer/production-requests/${encodeURIComponent(request.id)}`);
}
