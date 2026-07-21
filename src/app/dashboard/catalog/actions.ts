"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { nanoid } from "nanoid";
import { MediaKind, ProductCondition } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { imageListFromUrl } from "@/lib/product-images";
import { createOptimizedMediaAsset } from "@/lib/media-storage";

const categorySchema = z.object({
  name: z.string().min(2).max(80),
  attributeTemplateId: z.string().optional(),
});

export async function createCategoryAction(formData: FormData) {
  const session = await requireRole(permissions.catalogWrite);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    attributeTemplateId: formData.get("attributeTemplateId") || undefined,
  });

  if (!parsed.success) redirect("/dashboard/catalog?error=category");

  const category = await prisma.category.create({
    data: {
      shopId: session.shopId,
      name: parsed.data.name,
      attributeTemplateId: parsed.data.attributeTemplateId,
    },
  });

  await audit({
    shopId: session.shopId,
    userId: session.id,
    action: "catalog.category_created",
    entityType: "Category",
    entityId: category.id,
  });

  revalidatePath("/dashboard/catalog");
}

const updateCategorySchema = categorySchema.extend({ categoryId: z.string().min(1) });

export async function updateCategoryAction(formData: FormData) {
  const session = await requireRole(permissions.catalogWrite);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  const parsed = updateCategorySchema.safeParse({
    categoryId: formData.get("categoryId"),
    name: formData.get("name"),
    attributeTemplateId: formData.get("attributeTemplateId") || undefined,
  });
  if (!parsed.success) redirect("/dashboard/catalog?error=category-update");

  const category = await prisma.category.findFirst({ where: { id: parsed.data.categoryId, shopId: session.shopId } });
  if (!category) redirect("/dashboard/catalog?error=category-not-found");
  await prisma.category.update({
    where: { id: category.id },
    data: { name: parsed.data.name, attributeTemplateId: parsed.data.attributeTemplateId ?? null },
  });
  await audit({ shopId: session.shopId, userId: session.id, action: "catalog.category_updated", entityType: "Category", entityId: category.id });
  revalidatePath("/dashboard/catalog");
}

const productSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  categoryId: z.string().min(1),
  brand: z.string().optional(),
  imageUrl: z.string().url().optional(),
  productType: z.string().optional(),
  sportType: z.string().optional(),
  teamName: z.string().optional(),
  sizeGuide: z.string().optional(),
  size: z.string().optional(),
  color: z.string().optional(),
  equipmentGroup: z.string().optional(),
  condition: z.nativeEnum(ProductCondition),
  basePrice: z.coerce.number().positive(),
  stockQty: z.coerce.number().int().min(0),
  sku: z.string().optional(),
  lowStockThreshold: z.coerce.number().int().min(0).default(5),
  isPersonalizable: z.boolean().default(false),
  isService: z.boolean().default(false),
  isRentable: z.boolean().default(false),
});

function compactAttributes(input: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value && value.trim().length > 0),
  );
}

export async function createProductAction(formData: FormData) {
  const session = await requireRole(permissions.catalogWrite);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");

  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    categoryId: formData.get("categoryId"),
    brand: formData.get("brand") || undefined,
    imageUrl: formData.get("imageUrl") || undefined,
    productType: formData.get("productType") || undefined,
    sportType: formData.get("sportType") || undefined,
    teamName: formData.get("teamName") || undefined,
    sizeGuide: formData.get("sizeGuide") || undefined,
    size: formData.get("size") || undefined,
    color: formData.get("color") || undefined,
    equipmentGroup: formData.get("equipmentGroup") || undefined,
    condition: formData.get("condition"),
    basePrice: formData.get("basePrice"),
    stockQty: formData.get("stockQty"),
    sku: formData.get("sku") || undefined,
    lowStockThreshold: formData.get("lowStockThreshold"),
    isPersonalizable: formData.get("isPersonalizable") === "on",
    isService: formData.get("isService") === "on",
    isRentable: formData.get("isRentable") === "on",
  });

  if (!parsed.success) redirect("/dashboard/catalog?error=product");

  const uploadedPhoto = formData.get("photo");
  const mediaAsset = uploadedPhoto instanceof File && uploadedPhoto.size > 0
    ? await createOptimizedMediaAsset({
        file: uploadedPhoto,
        shopId: session.shopId,
        uploadedById: session.id,
        kind: MediaKind.PRODUCT,
      })
    : null;
  const sku = parsed.data.sku?.trim() || `${parsed.data.name.slice(0, 3).toUpperCase()}-${nanoid(6).toUpperCase()}`;
  const sizeGuide = parsed.data.sizeGuide
    ? parsed.data.sizeGuide.split(",").map((item) => item.trim()).filter(Boolean)
    : [];
  const product = await prisma.product.create({
    data: {
      shopId: session.shopId,
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      description: parsed.data.description,
      brand: parsed.data.brand,
      productType: parsed.data.productType,
      sportType: parsed.data.sportType,
      teamName: parsed.data.teamName,
      sizeGuide,
      images: mediaAsset ? [mediaAsset.url] : imageListFromUrl(parsed.data.imageUrl),
      condition: parsed.data.condition,
      basePrice: parsed.data.basePrice,
      lowStockThreshold: parsed.data.lowStockThreshold,
      isPersonalizable: parsed.data.isPersonalizable,
      isService: parsed.data.isService,
      isRentable: parsed.data.isRentable,
      variants: {
        create: {
          sku,
          stockQty: parsed.data.isService ? 9999 : parsed.data.stockQty,
          attributes: compactAttributes({
            size: parsed.data.size,
            color: parsed.data.color,
            equipmentGroup: parsed.data.equipmentGroup,
            sportType: parsed.data.sportType,
            teamName: parsed.data.teamName,
          }),
        },
      },
    },
  });

  await audit({
    shopId: session.shopId,
    userId: session.id,
    action: "catalog.product_created",
    entityType: "Product",
    entityId: product.id,
  });

  revalidatePath("/dashboard/catalog");
}

const updateProductSchema = productSchema.omit({ imageUrl: true }).extend({
  productId: z.string().min(1),
  variantId: z.string().min(1),
  imageUrl: z.string().url().optional(),
});

export async function updateProductAction(formData: FormData) {
  const session = await requireRole(permissions.catalogWrite);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  const parsed = updateProductSchema.safeParse({
    productId: formData.get("productId"),
    variantId: formData.get("variantId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    categoryId: formData.get("categoryId"),
    brand: formData.get("brand") || undefined,
    imageUrl: formData.get("imageUrl") || undefined,
    productType: formData.get("productType") || undefined,
    sportType: formData.get("sportType") || undefined,
    teamName: formData.get("teamName") || undefined,
    sizeGuide: formData.get("sizeGuide") || undefined,
    size: formData.get("size") || undefined,
    color: formData.get("color") || undefined,
    equipmentGroup: formData.get("equipmentGroup") || undefined,
    condition: formData.get("condition"),
    basePrice: formData.get("basePrice"),
    stockQty: formData.get("stockQty"),
    sku: formData.get("sku") || undefined,
    lowStockThreshold: formData.get("lowStockThreshold"),
    isPersonalizable: formData.get("isPersonalizable") === "on",
    isService: formData.get("isService") === "on",
    isRentable: formData.get("isRentable") === "on",
  });
  if (!parsed.success) redirect("/dashboard/catalog?error=product-update");

  const product = await prisma.product.findFirst({
    where: { id: parsed.data.productId, shopId: session.shopId },
    include: { variants: { where: { id: parsed.data.variantId } } },
  });
  const category = await prisma.category.findFirst({ where: { id: parsed.data.categoryId, shopId: session.shopId } });
  if (!product || !category || !product.variants[0]) redirect("/dashboard/catalog?error=product-not-found");

  const uploadedPhoto = formData.get("photo");
  const mediaAsset = uploadedPhoto instanceof File && uploadedPhoto.size > 0
    ? await createOptimizedMediaAsset({ file: uploadedPhoto, shopId: session.shopId, uploadedById: session.id, kind: MediaKind.PRODUCT })
    : null;
  const nextImages = mediaAsset ? [mediaAsset.url] : parsed.data.imageUrl ? imageListFromUrl(parsed.data.imageUrl) : undefined;
  const sizeGuide = parsed.data.sizeGuide ? parsed.data.sizeGuide.split(",").map((item) => item.trim()).filter(Boolean) : [];

  await prisma.$transaction([
    prisma.product.update({
      where: { id: product.id },
      data: {
        categoryId: category.id,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        brand: parsed.data.brand ?? null,
        productType: parsed.data.productType ?? null,
        sportType: parsed.data.sportType ?? null,
        teamName: parsed.data.teamName ?? null,
        sizeGuide,
        images: nextImages,
        condition: parsed.data.condition,
        basePrice: parsed.data.basePrice,
        lowStockThreshold: parsed.data.lowStockThreshold,
        isPersonalizable: parsed.data.isPersonalizable,
        isService: parsed.data.isService,
        isRentable: parsed.data.isRentable,
      },
    }),
    prisma.productVariant.update({
      where: { id: product.variants[0].id },
      data: {
        sku: parsed.data.sku?.trim() || product.variants[0].sku,
        stockQty: parsed.data.isService ? 9999 : parsed.data.stockQty,
        attributes: compactAttributes({
          size: parsed.data.size,
          color: parsed.data.color,
          equipmentGroup: parsed.data.equipmentGroup,
          sportType: parsed.data.sportType,
          teamName: parsed.data.teamName,
        }),
      },
    }),
  ]);
  await audit({ shopId: session.shopId, userId: session.id, action: "catalog.product_updated", entityType: "Product", entityId: product.id });
  revalidatePath("/dashboard/catalog");
}
