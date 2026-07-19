"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { nanoid } from "nanoid";
import { ProductCondition } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { imageListFromUrl } from "@/lib/product-images";

const categorySchema = z.object({
  name: z.string().min(2).max(80),
  attributeTemplateId: z.string().optional(),
});

export async function createCategoryAction(formData: FormData) {
  const session = await requireRole(permissions.catalogWrite);
  if (!session.shopId) redirect("/login");

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
  if (!session.shopId) redirect("/login");

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
      images: imageListFromUrl(parsed.data.imageUrl),
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
