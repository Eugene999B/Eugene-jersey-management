export function productImages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function firstProductImage(value: unknown) {
  return productImages(value)[0] ?? null;
}

export function imageListFromUrl(url: string | null | undefined): string[] {
  const trimmed = url?.trim();
  return trimmed ? [trimmed] : [];
}
