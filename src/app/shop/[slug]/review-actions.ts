"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { OrderStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getBuyerSession } from "@/lib/buyer-session";
import { audit } from "@/lib/audit";
import { enforceRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  shopSlug: z.string().trim().min(1).max(100),
  productId: z.string().min(1).max(100),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});

export async function createProductReviewAction(formData: FormData) {
  const parsed = schema.safeParse({
    shopSlug: formData.get("shopSlug"),
    productId: formData.get("productId"),
    rating: formData.get("rating"),
    comment: formData.get("comment") || undefined,
  });
  if (!parsed.success) redirect("/shops?error=review");

  const buyer = await getBuyerSession();
  if (!buyer) redirect(`/buyer/login?next=${encodeURIComponent(`/shop/${parsed.data.shopSlug}`)}&error=login-required`);
  try {
    await enforceRateLimit({ key: `buyer-review:${buyer.id}:${parsed.data.productId}`, limit: 10, windowSeconds: 24 * 60 * 60 });
  } catch {
    redirect(`/shop/${parsed.data.shopSlug}?error=review-rate`);
  }

  const product = await prisma.product.findFirst({
    where: {
      id: parsed.data.productId,
      shop: { slug: parsed.data.shopSlug, isActive: true, storefrontEnabled: true },
    },
    include: { shop: true },
  });
  if (!product) redirect(`/shop/${parsed.data.shopSlug}?error=review`);

  const purchased = await prisma.orderItem.findFirst({
    where: {
      productVariant: { productId: product.id },
      order: { buyerId: buyer.id, status: OrderStatus.COMPLETED },
    },
    select: { id: true },
  });
  if (!purchased) redirect(`/shop/${parsed.data.shopSlug}?error=review-purchase`);

  const review = await prisma.productReview.upsert({
    where: { productId_buyerId: { productId: product.id, buyerId: buyer.id } },
    update: { rating: parsed.data.rating, comment: parsed.data.comment, isApproved: true },
    create: {
      shopId: product.shopId,
      productId: product.id,
      buyerId: buyer.id,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    },
  });

  await audit({
    shopId: product.shopId,
    action: "public.product_review_saved",
    entityType: "ProductReview",
    entityId: review.id,
    metadata: { productId: product.id, buyerId: buyer.id, rating: parsed.data.rating },
  });
  revalidatePath(`/shop/${parsed.data.shopSlug}`);
}
