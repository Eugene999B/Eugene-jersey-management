"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getBuyerSession } from "@/lib/buyer-session";
import { audit } from "@/lib/audit";

const schema = z.object({
  shopSlug: z.string().min(1),
  productId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
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

  const product = await prisma.product.findFirst({
    where: { id: parsed.data.productId, shop: { slug: parsed.data.shopSlug, isActive: true } },
    include: { shop: true },
  });
  if (!product) redirect(`/shop/${parsed.data.shopSlug}?error=review`);

  const review = await prisma.productReview.upsert({
    where: { productId_buyerId: { productId: product.id, buyerId: buyer.id } },
    update: {
      rating: parsed.data.rating,
      comment: parsed.data.comment,
      isApproved: true,
    },
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
