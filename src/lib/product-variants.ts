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

export function productVariantSize(attributes: unknown) {
  return productVariantAttributes(attributes).size ?? "";
}

export function productVariantIsArchived(attributes: unknown) {
  return productVariantAttributes(attributes)._archived === "true";
}

export function productVariantLabel(
  variant: ProductVariantLike,
  options: { includeSku?: boolean; includeStock?: boolean } = {},
) {
  const attributes = productVariantAttributes(variant.attributes);
  const parts: string[] = [];
  const size = attributes.size;
  const color = attributes.color;

  parts.push(size ? `Size ${size}` : "Standard");
  if (color) parts.push(color);
  if (options.includeSku) parts.push(variant.sku);
  if (options.includeStock !== false) parts.push(`${variant.stockQty} available`);
  return parts.join(" · ");
}

export function activeProductVariants<T extends { attributes: unknown }>(variants: T[]) {
  return variants.filter((variant) => !productVariantIsArchived(variant.attributes));
}
