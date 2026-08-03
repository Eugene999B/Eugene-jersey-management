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
import { productVariantAttributes, productVariantFormValues, productVariantSize } from "@/lib/product-variants";
import { variantOptionSignature, variantOptionsFromRow } from "@/lib/catalog-options";
import { assertProductCreationAvailable, commercialSubscriptionError } from "@/lib/subscription-hardening";

const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  attributeTemplateId: z.string().max(100).optional(),
});

async function tenantTemplate(shopId: string, templateId?: string) {
  if (!templateId) return null;
  return prisma.attributeTemplate.findFirst({ where: { id: templateId, shopId }, select: { id: true } });
}

async function resolveCategory(shopId: string, categoryId?: string) {
  if (categoryId) {
    return prisma.category.findFirst({ where: { id: categoryId, shopId }, select: { id: true } });
  }
  return prisma.category.upsert({
    where: { shopId_name: { shopId, name: "Uncategorised" } },
    update: {},
    create: { shopId, name: "Uncategorised" },
    select: { id: true },
  });
}

export async function createCategoryAction(formData: FormData) {
  const session = await requireRole(permissions.catalogWrite);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    attributeTemplateId: formData.get("attributeTemplateId") || undefined,
  });
  if (!parsed.success) redirect("/dashboard/catalog?error=category");
  const template = await tenantTemplate(session.shopId, parsed.data.attributeTemplateId);
  if (parsed.data.attributeTemplateId && !template) redirect("/dashboard/catalog?error=template-not-found");

  const category = await prisma.category.create({
    data: { shopId: session.shopId, name: parsed.data.name, attributeTemplateId: template?.id },
  });
  await audit({ shopId: session.shopId, userId: session.id, action: "catalog.category_created", entityType: "Category", entityId: category.id });
  revalidatePath("/dashboard/catalog");
}

const updateCategorySchema = categorySchema.extend({ categoryId: z.string().min(1).max(100) });

export async function updateCategoryAction(formData: FormData) {
  const session = await requireRole(permissions.catalogWrite);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  const parsed = updateCategorySchema.safeParse({
    categoryId: formData.get("categoryId"),
    name: formData.get("name"),
    attributeTemplateId: formData.get("attributeTemplateId") || undefined,
  });
  if (!parsed.success) redirect("/dashboard/catalog?error=category-update");

  const [category, template] = await Promise.all([
    prisma.category.findFirst({ where: { id: parsed.data.categoryId, shopId: session.shopId } }),
    tenantTemplate(session.shopId, parsed.data.attributeTemplateId),
  ]);
  if (!category || (parsed.data.attributeTemplateId && !template)) redirect("/dashboard/catalog?error=category-not-found");
  await prisma.category.update({ where: { id: category.id }, data: { name: parsed.data.name, attributeTemplateId: template?.id ?? null } });
  await audit({ shopId: session.shopId, userId: session.id, action: "catalog.category_updated", entityType: "Category", entityId: category.id });
  revalidatePath("/dashboard/catalog");
}

const optionalPrice = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : Number(value),
  z.number().positive().max(100_000_000).optional(),
);

const optionText = z.string().trim().max(120).default("");
const variantRowSchema = z.object({
  id: z.string().trim().min(1).max(100).optional(),
  size: optionText,
  color: optionText,
  material: optionText,
  model: optionText,
  capacity: optionText,
  unit: optionText,
  condition: optionText,
  duration: optionText,
  customAttributes: z.string().trim().max(1200).default(""),
  stockQty: z.preprocess((value) => Number(value), z.number().int().min(0).max(10_000_000)),
  sku: z.string().trim().max(100).default(""),
  priceOverride: optionalPrice,
});

const variantRowsSchema = z.array(variantRowSchema).min(1).max(80).superRefine((rows, context) => {
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const key = variantOptionSignature(variantOptionsFromRow(row));
    if (seen.has(key)) {
      context.addIssue({ code: "custom", message: "Each exact option combination must be listed once.", path: [index] });
    }
    seen.add(key);
  });
});

type VariantRow = z.infer<typeof variantRowSchema>;

const productSchema = z.object({
  name: z.string().trim().min(2).max(140),
  description: z.string().trim().max(2000).optional(),
  categoryId: z.string().trim().max(100).optional(),
  brand: z.string().trim().max(100).optional(),
  imageUrl: z.string().url().max(2000).optional(),
  productType: z.string().trim().max(100).optional(),
  sportType: z.string().trim().max(100).optional(),
  teamName: z.string().trim().max(120).optional(),
  color: z.string().trim().max(80).optional(),
  equipmentGroup: z.string().trim().max(100).optional(),
  condition: z.nativeEnum(ProductCondition).default(ProductCondition.NEW),
  basePrice: z.coerce.number().positive().max(100_000_000),
  lowStockThreshold: z.coerce.number().int().min(0).max(1_000_000).default(5),
  isPersonalizable: z.boolean().default(false),
  isService: z.boolean().default(false),
  isRentable: z.boolean().default(false),
});

function parseProduct(formData: FormData) {
  return productSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    categoryId: formData.get("categoryId") || undefined,
    brand: formData.get("brand") || undefined,
    imageUrl: formData.get("imageUrl") || undefined,
    productType: formData.get("productType") || undefined,
    sportType: formData.get("sportType") || undefined,
    teamName: formData.get("teamName") || undefined,
    color: formData.get("color") || undefined,
    equipmentGroup: formData.get("equipmentGroup") || undefined,
    condition: formData.get("condition") || ProductCondition.NEW,
    basePrice: formData.get("basePrice"),
    lowStockThreshold: formData.get("lowStockThreshold") || 5,
    isPersonalizable: formData.get("isPersonalizable") === "on",
    isService: formData.get("isService") === "on",
    isRentable: formData.get("isRentable") === "on",
  });
}

function parseVariantRows(formData: FormData): VariantRow[] | null {
  const raw = formData.get("variantsJson");
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = variantRowsSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  const legacy = variantRowsSchema.safeParse([{
    id: formData.get("variantId") || undefined,
    size: String(formData.get("size") || ""),
    color: "",
    material: "",
    model: "",
    capacity: "",
    unit: "",
    condition: "",
    duration: "",
    customAttributes: "",
    stockQty: Number(formData.get("stockQty") || 0),
    sku: String(formData.get("sku") || ""),
    priceOverride: undefined,
  }]);
  return legacy.success ? legacy.data : null;
}

function skuPart(value: string, fallback: string) {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 18);
  return cleaned || fallback;
}

function variantSku(productName: string, row: VariantRow) {
  if (row.sku) return row.sku;
  const optionCode = Object.values(variantOptionsFromRow(row)).slice(0, 3).join("-") || "STD";
  return `${skuPart(productName, "ITEM")}-${skuPart(optionCode, "STD")}-${nanoid(5).toUpperCase()}`;
}

function mergeVariantAttributes(existing: unknown, row: VariantRow, inherited: { color?: string; equipmentGroup?: string; sportType?: string; teamName?: string }) {
  const next: Record<string, string> = { ...productVariantAttributes(existing) };
  delete next._archived;
  for (const key of ["size", "color", "material", "model", "capacity", "unit", "condition", "duration"]) delete next[key];
  for (const key of Object.keys(next)) if (key.startsWith("custom_")) delete next[key];
  Object.assign(next, variantOptionsFromRow({ ...row, color: row.color || inherited.color || "" }));
  for (const [key, value] of Object.entries(inherited)) {
    if (key === "color") continue;
    if (value?.trim()) next[key] = value.trim();
    else delete next[key];
  }
  return next;
}

function sizeGuide(rows: VariantRow[]) {
  return [...new Set(rows.map((row) => row.size.trim()).filter((size) => size && size !== "Service"))].slice(0, 100);
}

function serviceRows(rows: VariantRow[], firstExistingId?: string): VariantRow[] {
  const first = rows[0] ?? {
    size: "Service", color: "", material: "", model: "", capacity: "", unit: "Service",
    condition: "", duration: "", customAttributes: "", stockQty: 9999, sku: "", priceOverride: undefined,
  };
  return [{ ...first, id: first.id ?? firstExistingId, size: first.size || "Service", unit: first.unit || "Service", stockQty: 9999 }];
}

export async function createProductAction(formData: FormData) {
  const session = await requireRole(permissions.catalogWrite);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  const parsed = parseProduct(formData);
  let variants = parseVariantRows(formData);
  if (!parsed.success || !variants) redirect("/dashboard/catalog?error=product");

  try {
    await assertProductCreationAvailable(session.shopId);
  } catch (error) {
    const commercial = commercialSubscriptionError(error);
    if (commercial?.code === "PRODUCT_LIMIT_REACHED") redirect("/dashboard/catalog?error=plan-product-limit");
    if (commercial?.code === "FEATURE_NOT_INCLUDED") redirect("/dashboard/catalog?error=plan-feature");
    if (commercial) redirect("/dashboard/catalog?error=subscription-blocked");
    throw error;
  }

  const category = await resolveCategory(session.shopId, parsed.data.categoryId);
  if (!category) redirect("/dashboard/catalog?error=category-not-found");
  if (parsed.data.isService) variants = serviceRows(variants);

  const uploadedPhoto = formData.get("photo");
  const mediaAsset = uploadedPhoto instanceof File && uploadedPhoto.size > 0
    ? await createOptimizedMediaAsset({ file: uploadedPhoto, shopId: session.shopId, uploadedById: session.id, kind: MediaKind.PRODUCT })
    : null;

  let product;
  try {
    product = await prisma.product.create({
      data: {
        shopId: session.shopId,
        categoryId: category.id,
        name: parsed.data.name,
        description: parsed.data.description,
        brand: parsed.data.brand,
        productType: parsed.data.productType,
        sportType: parsed.data.sportType,
        teamName: parsed.data.teamName,
        sizeGuide: sizeGuide(variants),
        images: mediaAsset ? [mediaAsset.url] : imageListFromUrl(parsed.data.imageUrl),
        condition: parsed.data.condition,
        basePrice: parsed.data.basePrice,
        lowStockThreshold: parsed.data.lowStockThreshold,
        isPersonalizable: parsed.data.isPersonalizable,
        isService: parsed.data.isService,
        isRentable: parsed.data.isRentable,
        variants: {
          create: variants.map((row) => ({
            sku: variantSku(parsed.data.name, row),
            stockQty: parsed.data.isService ? 9999 : row.stockQty,
            priceOverride: row.priceOverride ?? null,
            attributes: mergeVariantAttributes(null, row, {
              color: parsed.data.color,
              equipmentGroup: parsed.data.equipmentGroup,
              sportType: parsed.data.sportType,
              teamName: parsed.data.teamName,
            }),
          })),
        },
      },
    });
  } catch (error) {
    const commercial = commercialSubscriptionError(error);
    if (commercial?.code === "PRODUCT_LIMIT_REACHED") redirect("/dashboard/catalog?error=plan-product-limit");
    if (commercial?.code === "FEATURE_NOT_INCLUDED") redirect("/dashboard/catalog?error=plan-feature");
    if (commercial) redirect("/dashboard/catalog?error=subscription-blocked");
    redirect("/dashboard/catalog?error=sku-exists");
  }
  await audit({
    shopId: session.shopId,
    userId: session.id,
    action: "catalog.product_created",
    entityType: "Product",
    entityId: product.id,
    metadata: { variantCount: variants.length, categorySelected: Boolean(parsed.data.categoryId) },
  });
  revalidatePath("/dashboard/catalog");
  revalidatePath("/dashboard/pos");
}

const productIdentitySchema = z.object({ productId: z.string().min(1).max(100) });

export async function updateProductAction(formData: FormData) {
  const session = await requireRole(permissions.catalogWrite);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  const identity = productIdentitySchema.safeParse({ productId: formData.get("productId") });
  const parsed = parseProduct(formData);
  let submittedRows = parseVariantRows(formData);
  if (!identity.success || !parsed.success || !submittedRows) redirect("/dashboard/catalog?error=product-update");

  const [product, category] = await Promise.all([
    prisma.product.findFirst({ where: { id: identity.data.productId, shopId: session.shopId }, include: { variants: { orderBy: { createdAt: "asc" } } } }),
    resolveCategory(session.shopId, parsed.data.categoryId),
  ]);
  if (!product || !category) redirect("/dashboard/catalog?error=product-not-found");

  const existingById = new Map(product.variants.map((variant) => [variant.id, variant]));
  if (submittedRows.some((row) => row.id && !existingById.has(row.id))) redirect("/dashboard/catalog?error=product-not-found");
  if (parsed.data.isService) submittedRows = serviceRows(submittedRows, product.variants[0]?.id);

  const uploadedPhoto = formData.get("photo");
  const mediaAsset = uploadedPhoto instanceof File && uploadedPhoto.size > 0
    ? await createOptimizedMediaAsset({ file: uploadedPhoto, shopId: session.shopId, uploadedById: session.id, kind: MediaKind.PRODUCT })
    : null;
  const nextImages = mediaAsset ? [mediaAsset.url] : parsed.data.imageUrl ? imageListFromUrl(parsed.data.imageUrl) : undefined;

  const submittedById = new Map(submittedRows.filter((row) => row.id).map((row) => [row.id as string, row]));
  const mergedRows: VariantRow[] = [
    ...product.variants.map((variant) => submittedById.get(variant.id) ?? {
      id: variant.id,
      ...productVariantFormValues(variant.attributes),
      size: productVariantSize(variant.attributes),
      stockQty: variant.stockQty,
      sku: variant.sku,
      priceOverride: variant.priceOverride ? Number(variant.priceOverride) : undefined,
    }),
    ...submittedRows.filter((row) => !row.id),
  ];

  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: product.id },
        data: {
          categoryId: category.id,
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          brand: parsed.data.brand ?? null,
          productType: parsed.data.productType ?? null,
          sportType: parsed.data.sportType ?? null,
          teamName: parsed.data.teamName ?? null,
          sizeGuide: sizeGuide(parsed.data.isService ? submittedRows : mergedRows),
          images: nextImages,
          condition: parsed.data.condition,
          basePrice: parsed.data.basePrice,
          lowStockThreshold: parsed.data.lowStockThreshold,
          isPersonalizable: parsed.data.isPersonalizable,
          isService: parsed.data.isService,
          isRentable: parsed.data.isRentable,
        },
      });

      for (const row of submittedRows) {
        const existing = row.id ? existingById.get(row.id) : null;
        const data = {
          sku: variantSku(parsed.data.name, row),
          stockQty: parsed.data.isService ? 9999 : row.stockQty,
          priceOverride: row.priceOverride ?? null,
          attributes: mergeVariantAttributes(existing?.attributes, row, {
            color: parsed.data.color,
            equipmentGroup: parsed.data.equipmentGroup,
            sportType: parsed.data.sportType,
            teamName: parsed.data.teamName,
          }),
        };
        if (existing) await tx.productVariant.update({ where: { id: existing.id }, data });
        else await tx.productVariant.create({ data: { productId: product.id, ...data } });
      }

      if (parsed.data.isService && submittedRows[0]?.id) {
        await tx.productVariant.updateMany({
          where: { productId: product.id, id: { not: submittedRows[0].id } },
          data: { stockQty: 0 },
        });
      }
    });
  } catch {
    redirect("/dashboard/catalog?error=sku-exists");
  }

  await audit({
    shopId: session.shopId,
    userId: session.id,
    action: "catalog.product_updated",
    entityType: "Product",
    entityId: product.id,
    metadata: { submittedVariantCount: submittedRows.length, categorySelected: Boolean(parsed.data.categoryId) },
  });
  revalidatePath("/dashboard/catalog");
  revalidatePath("/dashboard/pos");
}
