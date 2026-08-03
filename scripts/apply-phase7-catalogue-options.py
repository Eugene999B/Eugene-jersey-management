from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected one match in {path}, found {count}: {old[:140]!r}")
    file_path.write_text(text.replace(old, new, 1))


replace_once(
    "src/app/dashboard/catalog/actions.ts",
    'import { productVariantAttributes, productVariantSize } from "@/lib/product-variants";\n',
    'import { productVariantAttributes, productVariantFormValues, productVariantSize } from "@/lib/product-variants";\nimport { variantOptionSignature, variantOptionsFromRow } from "@/lib/catalog-options";\n',
)

old_schema = '''const variantRowSchema = z.object({
  id: z.string().trim().min(1).max(100).optional(),
  size: z.string().trim().max(80).default(""),
  stockQty: z.preprocess((value) => Number(value), z.number().int().min(0).max(10_000_000)),
  sku: z.string().trim().max(100).default(""),
  priceOverride: optionalPrice,
});

const variantRowsSchema = z.array(variantRowSchema).min(1).max(40).superRefine((rows, context) => {
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const key = (row.size || "Standard").toLocaleLowerCase();
    if (seen.has(key)) {
      context.addIssue({ code: "custom", message: "Each size or option must be listed once.", path: [index, "size"] });
    }
    seen.add(key);
  });
});
'''
new_schema = '''const optionText = z.string().trim().max(120).default("");
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
'''
replace_once("src/app/dashboard/catalog/actions.ts", old_schema, new_schema)

replace_once(
    "src/app/dashboard/catalog/actions.ts",
    '''  const legacy = variantRowsSchema.safeParse([{
    id: formData.get("variantId") || undefined,
    size: String(formData.get("size") || ""),
    stockQty: Number(formData.get("stockQty") || 0),
    sku: String(formData.get("sku") || ""),
    priceOverride: undefined,
  }]);
''',
    '''  const legacy = variantRowsSchema.safeParse([{
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
''',
)

replace_once(
    "src/app/dashboard/catalog/actions.ts",
    '''function variantSku(productName: string, row: VariantRow) {
  if (row.sku) return row.sku;
  return `${skuPart(productName, "ITEM")}-${skuPart(row.size || "STD", "STD")}-${nanoid(5).toUpperCase()}`;
}

function mergeVariantAttributes(existing: unknown, input: { size: string; color?: string; equipmentGroup?: string; sportType?: string; teamName?: string }) {
  const next: Record<string, string> = { ...productVariantAttributes(existing) };
  delete next._archived;
  for (const [key, value] of Object.entries(input)) {
    if (value?.trim()) next[key] = value.trim();
    else delete next[key];
  }
  return next;
}
''',
    '''function variantSku(productName: string, row: VariantRow) {
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
''',
)

replace_once(
    "src/app/dashboard/catalog/actions.ts",
    '''function serviceRows(rows: VariantRow[], firstExistingId?: string): VariantRow[] {
  const first = rows[0] ?? { size: "Service", stockQty: 9999, sku: "", priceOverride: undefined };
  return [{ ...first, id: first.id ?? firstExistingId, size: "Service", stockQty: 9999 }];
}
''',
    '''function serviceRows(rows: VariantRow[], firstExistingId?: string): VariantRow[] {
  const first = rows[0] ?? {
    size: "Service", color: "", material: "", model: "", capacity: "", unit: "Service",
    condition: "", duration: "", customAttributes: "", stockQty: 9999, sku: "", priceOverride: undefined,
  };
  return [{ ...first, id: first.id ?? firstExistingId, size: first.size || "Service", unit: first.unit || "Service", stockQty: 9999 }];
}
''',
)

replace_once(
    "src/app/dashboard/catalog/actions.ts",
    '''            attributes: mergeVariantAttributes(null, {
              size: row.size,
              color: parsed.data.color,
              equipmentGroup: parsed.data.equipmentGroup,
              sportType: parsed.data.sportType,
              teamName: parsed.data.teamName,
            }),
''',
    '''            attributes: mergeVariantAttributes(null, row, {
              color: parsed.data.color,
              equipmentGroup: parsed.data.equipmentGroup,
              sportType: parsed.data.sportType,
              teamName: parsed.data.teamName,
            }),
''',
)

replace_once(
    "src/app/dashboard/catalog/actions.ts",
    '''    ...product.variants.map((variant) => submittedById.get(variant.id) ?? {
      id: variant.id,
      size: productVariantSize(variant.attributes),
      stockQty: variant.stockQty,
      sku: variant.sku,
      priceOverride: variant.priceOverride ? Number(variant.priceOverride) : undefined,
    }),
''',
    '''    ...product.variants.map((variant) => submittedById.get(variant.id) ?? {
      id: variant.id,
      ...productVariantFormValues(variant.attributes),
      size: productVariantSize(variant.attributes),
      stockQty: variant.stockQty,
      sku: variant.sku,
      priceOverride: variant.priceOverride ? Number(variant.priceOverride) : undefined,
    }),
''',
)

replace_once(
    "src/app/dashboard/catalog/actions.ts",
    '''          attributes: mergeVariantAttributes(existing?.attributes, {
            size: row.size,
            color: parsed.data.color,
            equipmentGroup: parsed.data.equipmentGroup,
            sportType: parsed.data.sportType,
            teamName: parsed.data.teamName,
          }),
''',
    '''          attributes: mergeVariantAttributes(existing?.attributes, row, {
            color: parsed.data.color,
            equipmentGroup: parsed.data.equipmentGroup,
            sportType: parsed.data.sportType,
            teamName: parsed.data.teamName,
          }),
''',
)

print("Phase 7 catalogue option integration applied.")
