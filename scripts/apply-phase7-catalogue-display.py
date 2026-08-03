from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected one match in {path}, found {count}: {old[:150]!r}")
    file_path.write_text(text.replace(old, new, 1))


replace_once(
    "src/app/dashboard/catalog/page.tsx",
    'import { activeProductVariants, productVariantLabel, productVariantSize } from "@/lib/product-variants";\n',
    'import { activeProductVariants, productVariantFormValues, productVariantLabel } from "@/lib/product-variants";\nimport { GENERIC_ITEM_TYPES } from "@/lib/catalog-options";\n',
)
start = '''const productTypes = [
  "Stocked product",
  "Service",
  "Custom production item",
  "Rental asset",
  "Bundle",
  "Non-stock item",
  "Garment",
  "Equipment",
];

'''
replace_once("src/app/dashboard/catalog/page.tsx", start, "")
replace_once(
    "src/app/dashboard/catalog/page.tsx",
    '''          <select className="field" name="productType" defaultValue={product?.productType ?? ""} disabled={disabled}>
            <option value="">Item type (optional)</option>
            <optgroup label="General business">{productTypes.map((type) => <option key={type} value={type}>{type}</option>)}</optgroup>
            <optgroup label="Sports-shop template (optional)">{sportsShopProductTypes.map((type) => <option key={type} value={type}>{type}</option>)}</optgroup>
          </select>
''',
    '''          <label className="block text-xs font-semibold text-slate-600">
            Item type
            <select className="field mt-1" name="productType" defaultValue={product?.productType ?? "Stocked product"} disabled={disabled} required>
              {product?.productType && !GENERIC_ITEM_TYPES.includes(product.productType as (typeof GENERIC_ITEM_TYPES)[number]) && !sportsShopProductTypes.includes(product.productType) ? <option value={product.productType}>{product.productType} (existing)</option> : null}
              <optgroup label="General business">{GENERIC_ITEM_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</optgroup>
              <optgroup label="Sports-shop template (optional)">{sportsShopProductTypes.map((type) => <option key={type} value={type}>{type}</option>)}</optgroup>
            </select>
          </label>
''',
)
replace_once(
    "src/app/dashboard/catalog/page.tsx",
    '<ProductVariantFields initialVariants={variants.map((variant) => ({ id: variant.id, size: productVariantSize(variant.attributes), stockQty: product.isService ? 0 : variant.stockQty, sku: variant.sku, priceOverride: variant.priceOverride?.toString() ?? "" }))} />',
    '<ProductVariantFields initialVariants={variants.map((variant) => ({ id: variant.id, ...productVariantFormValues(variant.attributes), stockQty: product.isService ? 0 : variant.stockQty, sku: variant.sku, priceOverride: variant.priceOverride?.toString() ?? "" }))} />',
)
replace_once(
    "src/app/dashboard/catalog/page.tsx",
    'product: "Enter a product name, valid price and at least one size/stock row.",\n  "product-update": "Check the product details and size rows, then try again.",',
    'product: "Enter an item name, valid price and at least one exact option row.",\n  "product-update": "Check the item details and exact option rows, then try again.",',
)

replace_once(
    "src/app/dashboard/orders/page.tsx",
    'import { permissions } from "@/lib/rbac";\n',
    'import { permissions } from "@/lib/rbac";\nimport { productVariantOptionLabel } from "@/lib/product-variants";\n',
)
replace_once(
    "src/app/dashboard/orders/page.tsx",
    '            name: item.productVariant.product.name,\n',
    '            name: `${item.productVariant.product.name} — ${productVariantOptionLabel(item.productVariant.attributes)}`,\n',
)

replace_once(
    "src/app/api/receipts/[orderId]/route.ts",
    'import { requireTenantShopId, withTenantScope } from "@/lib/tenant-scope";\n',
    'import { requireTenantShopId, withTenantScope } from "@/lib/tenant-scope";\nimport { productVariantOptionLabel } from "@/lib/product-variants";\n',
)
replace_once(
    "src/app/api/receipts/[orderId]/route.ts",
    '<td>${item.quantity}x ${escapeHtml(item.productVariant.product.name)}<br><small>${escapeHtml(item.productVariant.sku)}</small></td>',
    '<td>${item.quantity}x ${escapeHtml(item.productVariant.product.name)}<br><small>${escapeHtml(productVariantOptionLabel(item.productVariant.attributes))} · ${escapeHtml(item.productVariant.sku)}</small></td>',
)

replace_once(
    "src/app/track/[orderId]/page.tsx",
    'import { getBuyerSession } from "@/lib/buyer-session";\n',
    'import { getBuyerSession } from "@/lib/buyer-session";\nimport { productVariantOptionLabel } from "@/lib/product-variants";\n',
)
replace_once(
    "src/app/track/[orderId]/page.tsx",
    '<p className="text-sm text-slate-500">{item.productVariant.sku}</p>',
    '<p className="text-sm font-semibold text-cyan-700">{productVariantOptionLabel(item.productVariant.attributes)}</p><p className="text-xs text-slate-500">{item.productVariant.sku}</p>',
)

replace_once(
    "README.md",
    'Phase 6 adds `/admin/access`, an audited administrator access-grant ledger separate from ordinary recurring billing. Paid, free-trial, sponsored, promotional, free-forever, emergency and suspended access can carry exact dates, plan and feature terms, price overrides, invoice suppression and an explicit expiry outcome. The tenant subscription centre shows the active grant, while invoice generation and payment prompts are suppressed whenever the grant disables billing.\n',
    'Phase 6 adds `/admin/access`, an audited administrator access-grant ledger separate from ordinary recurring billing. Paid, free-trial, sponsored, promotional, free-forever, emergency and suspended access can carry exact dates, plan and feature terms, price overrides, invoice suppression and an explicit expiry outcome. The tenant subscription centre shows the active grant, while invoice generation and payment prompts are suppressed whenever the grant disables billing.\n\nPhase 7 generalizes the catalogue around stocked products, services, custom production items, rental assets, bundles and non-stock items. Every option can record size, colour, material, model, capacity, unit, condition, duration and custom attributes. POS groups those options under one item, disables unavailable choices, and requires an explicit highlighted selection before cart entry. The chosen option is preserved on the cart, order board, receipt and customer tracking page.\n',
)

print("Phase 7 catalogue and downstream option display applied.")
