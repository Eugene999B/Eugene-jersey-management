import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { activeProductVariants, productVariantLabel, productVariantSize } from "@/lib/product-variants";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("product size variants", () => {
  it("labels size-specific availability without requiring duplicate products", () => {
    const variant = { sku: "MANU-AWAY-XL", stockQty: 4, attributes: { size: "XL", color: "Black" } };
    expect(productVariantSize(variant.attributes)).toBe("XL");
    expect(productVariantLabel(variant)).toBe("Size XL · Black · 4 available");
  });

  it("keeps archived variants out of active inventory", () => {
    const variants = [
      { id: "active", attributes: { size: "M" } },
      { id: "archived", attributes: { size: "L", _archived: "true" } },
    ];
    expect(activeProductVariants(variants).map((variant) => variant.id)).toEqual(["active"]);
  });

  it("uses one catalog product with a JSON size matrix and variant-specific POS rows", () => {
    const actions = source("../app/dashboard/catalog/actions.ts");
    const catalog = source("../app/dashboard/catalog/page.tsx");
    const pos = source("../app/dashboard/pos/page.tsx");

    expect(actions).toContain('formData.get("variantsJson")');
    expect(actions).toContain("variants.map((row)");
    expect(actions).toContain('name: "Uncategorised"');
    expect(catalog).toContain("Only the name and base price are essential");
    expect(catalog).toContain("<ProductVariantFields");
    expect(pos).toContain("products.flatMap");
    expect(pos).toContain("productVariantLabel");
  });
});
