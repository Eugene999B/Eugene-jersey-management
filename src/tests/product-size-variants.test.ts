import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  customAttributesFromText,
  customAttributesToText,
  variantOptionEntries,
  variantOptionLabel,
  variantOptionSignature,
  variantOptionsFromRow,
} from "@/lib/catalog-options";
import {
  activeProductVariants,
  productVariantFormValues,
  productVariantLabel,
  productVariantOptionLabel,
  productVariantSize,
} from "@/lib/product-variants";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("generic product options", () => {
  it("labels exact multi-attribute availability without duplicate products", () => {
    const variant = {
      sku: "TEE-BLACK-XL",
      stockQty: 4,
      attributes: { size: "XL", color: "Black", material: "Cotton" },
    };

    expect(productVariantSize(variant.attributes)).toBe("XL");
    expect(productVariantOptionLabel(variant.attributes)).toBe("Size XL · Colour Black · Material Cotton");
    expect(productVariantLabel(variant)).toBe("Size XL · Colour Black · Material Cotton · 4 available");
  });

  it("normalizes built-in and custom option fields into a stable signature", () => {
    const options = variantOptionsFromRow({
      size: "  XL ",
      color: "Dark   Blue",
      material: "Cotton",
      customAttributes: "Sleeve: Long; Voltage: 240 V; invalid entry",
    });

    expect(options).toEqual({
      size: "XL",
      color: "Dark Blue",
      material: "Cotton",
      custom_sleeve: "Long",
      custom_voltage: "240 V",
    });
    expect(variantOptionSignature(options)).toBe(
      "size:xl|colour:dark blue|material:cotton|sleeve:long|voltage:240 v",
    );
  });

  it("round-trips custom option text for catalogue editing", () => {
    const parsed = customAttributesFromText("Sleeve length: Long; Wattage: 1200 W");
    expect(parsed).toEqual({ custom_sleeve_length: "Long", custom_wattage: "1200 W" });
    expect(customAttributesToText(parsed)).toBe("sleeve length: Long; wattage: 1200 W");

    const formValues = productVariantFormValues({
      size: "M",
      duration: "3 days",
      custom_voltage: "240 V",
      _archived: "false",
    });
    expect(formValues.size).toBe("M");
    expect(formValues.duration).toBe("3 days");
    expect(formValues.customAttributes).toBe("voltage: 240 V");
  });

  it("orders known option fields before custom attributes", () => {
    expect(variantOptionEntries({ custom_voltage: "240 V", model: "GX-20", capacity: "2 TB" })).toEqual([
      ["Model", "GX-20"],
      ["Capacity", "2 TB"],
      ["Voltage", "240 V"],
    ]);
    expect(variantOptionLabel({})).toBe("Standard");
  });

  it("keeps archived variants out of active inventory", () => {
    const variants = [
      { id: "active", attributes: { size: "M" } },
      { id: "archived", attributes: { size: "L", _archived: "true" } },
    ];
    expect(activeProductVariants(variants).map((variant) => variant.id)).toEqual(["active"]);
  });

  it("uses one catalogue item with explicit POS selection and downstream option labels", () => {
    const actions = source("../app/dashboard/catalog/actions.ts");
    const catalog = source("../app/dashboard/catalog/page.tsx");
    const posPage = source("../app/dashboard/pos/page.tsx");
    const posTerminal = source("../components/pos/pos-terminal.tsx");
    const optionSelector = source("../components/pos/product-option-selector.tsx");
    const receipt = source("../app/api/receipts/[orderId]/route.ts");
    const orders = source("../app/dashboard/orders/page.tsx");
    const tracking = source("../app/track/[orderId]/page.tsx");

    expect(actions).toContain('formData.get("variantsJson")');
    expect(actions).toContain("variantOptionSignature");
    expect(actions).toContain("variantOptionsFromRow");
    expect(catalog).toContain("Each item can hold exact options");
    expect(catalog).toContain("GENERIC_ITEM_TYPES");
    expect(posPage).toContain("products.map");
    expect(posPage).not.toContain("products.flatMap");
    expect(posTerminal).toContain("ProductOptionSelector");
    expect(posTerminal).toContain("choose exact option");
    expect(optionSelector).toContain("Exact option required");
    expect(optionSelector).toContain('role="radiogroup"');
    expect(receipt).toContain("productVariantOptionLabel");
    expect(orders).toContain("productVariantOptionLabel");
    expect(tracking).toContain("productVariantOptionLabel");
  });
});
