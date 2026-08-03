import {
  VARIANT_OPTION_FIELDS,
  cleanOptionValue,
  customAttributesToText,
  variantOptionEntries,
  variantOptionLabel,
  variantOptionSignature,
  type VariantOptionKey,
} from "@/lib/catalog-options";

export type ProductVariantLike = {
  sku: string;
  stockQty: number;
  attributes: unknown;
  priceOverride?: { toString(): string } | string | number | null;
};

export function productVariantAttributes(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== null && item !== undefined && String(item).trim() !== "")
      .map(([key, item]) => [key, String(item).trim()]),
  );
}

export function productVariantOption(attributes: unknown, key: VariantOptionKey) {
  return cleanOptionValue(productVariantAttributes(attributes)[key]);
}

export function productVariantSize(attributes: unknown) {
  return productVariantOption(attributes, "size");
}

export function productVariantIsArchived(attributes: unknown) {
  return productVariantAttributes(attributes)._archived === "true";
}

export function productVariantFormValues(attributes: unknown) {
  const source = productVariantAttributes(attributes);
  return {
    ...Object.fromEntries(VARIANT_OPTION_FIELDS.map((field) => [field.key, source[field.key] ?? ""])),
    customAttributes: customAttributesToText(source),
  } as Record<VariantOptionKey, string> & { customAttributes: string };
}

export function productVariantOptionEntries(attributes: unknown) {
  return variantOptionEntries(attributes);
}

export function productVariantOptionLabel(attributes: unknown, fallback = "Standard") {
  return variantOptionLabel(attributes, fallback);
}

export function productVariantOptionSignature(attributes: unknown) {
  return variantOptionSignature(attributes);
}

export function productVariantLabel(
  variant: ProductVariantLike,
  options: { includeSku?: boolean; includeStock?: boolean } = {},
) {
  const parts = [productVariantOptionLabel(variant.attributes)];
  if (options.includeSku) parts.push(variant.sku);
  if (options.includeStock !== false) parts.push(`${variant.stockQty} available`);
  return parts.join(" · ");
}

export function activeProductVariants<T extends { attributes: unknown }>(variants: T[]) {
  return variants.filter((variant) => !productVariantIsArchived(variant.attributes));
}
