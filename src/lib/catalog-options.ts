export const GENERIC_ITEM_TYPES = [
  "Stocked product",
  "Service",
  "Custom production item",
  "Rental asset",
  "Bundle",
  "Non-stock item",
] as const;

export type GenericItemType = (typeof GENERIC_ITEM_TYPES)[number];

export const VARIANT_OPTION_FIELDS = [
  { key: "size", label: "Size", placeholder: "XL, 500 ml, Standard" },
  { key: "color", label: "Colour", placeholder: "Blue, Black, Red" },
  { key: "material", label: "Material", placeholder: "Cotton, Steel, Vinyl" },
  { key: "model", label: "Model", placeholder: "Model or part number" },
  { key: "capacity", label: "Capacity", placeholder: "2 TB, 20 litres" },
  { key: "unit", label: "Unit", placeholder: "Piece, metre, box" },
  { key: "condition", label: "Condition", placeholder: "New, used, refurbished" },
  { key: "duration", label: "Duration", placeholder: "1 hour, 3 days" },
] as const;

export type VariantOptionKey = (typeof VARIANT_OPTION_FIELDS)[number]["key"];
export type VariantOptionValues = Partial<Record<VariantOptionKey, string>>;

export function cleanOptionValue(value: unknown, maximum = 120) {
  const cleaned = String(value ?? "").trim().replace(/\s+/g, " ");
  return cleaned ? cleaned.slice(0, maximum) : "";
}

export function customAttributesFromText(value: unknown) {
  const attributes: Record<string, string> = {};
  for (const part of String(value ?? "").split(/[;\n]+/)) {
    const separator = part.indexOf(":");
    if (separator < 1) continue;
    const key = cleanOptionValue(part.slice(0, separator), 60)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const item = cleanOptionValue(part.slice(separator + 1), 160);
    if (key && item && !key.startsWith("_")) attributes[`custom_${key}`] = item;
  }
  return attributes;
}

export function customAttributesToText(attributes: Record<string, string>) {
  return Object.entries(attributes)
    .filter(([key, value]) => key.startsWith("custom_") && value)
    .map(([key, value]) => `${key.slice(7).replaceAll("_", " ")}: ${value}`)
    .join("; ");
}

export function variantOptionsFromRow(row: VariantOptionValues & { customAttributes?: string }) {
  const options: Record<string, string> = {};
  for (const field of VARIANT_OPTION_FIELDS) {
    const value = cleanOptionValue(row[field.key]);
    if (value) options[field.key] = value;
  }
  return { ...options, ...customAttributesFromText(row.customAttributes) };
}

export function variantOptionEntries(attributes: unknown) {
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) return [] as Array<[string, string]>;
  const source = attributes as Record<string, unknown>;
  const known = VARIANT_OPTION_FIELDS.flatMap((field) => {
    const value = cleanOptionValue(source[field.key]);
    return value ? [[field.label, value] as [string, string]] : [];
  });
  const custom = Object.entries(source)
    .filter(([key, value]) => key.startsWith("custom_") && cleanOptionValue(value))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => [key.slice(7).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()), cleanOptionValue(value)] as [string, string]);
  return [...known, ...custom];
}

export function variantOptionLabel(attributes: unknown, fallback = "Standard") {
  const entries = variantOptionEntries(attributes);
  return entries.length ? entries.map(([label, value]) => `${label} ${value}`).join(" · ") : fallback;
}

export function variantOptionSignature(attributes: unknown) {
  const entries = variantOptionEntries(attributes);
  return entries.length
    ? entries.map(([label, value]) => `${label.toLowerCase()}:${value.toLowerCase()}`).join("|")
    : "standard";
}
