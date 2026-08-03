# Phase 7 — Generic catalogue and exact option selection

## Purpose

Phase 7 turns the catalogue into a general business inventory model while preserving existing products, variants, orders, receipts and stock history. A business can keep one item record and define the exact sellable or service options underneath it instead of creating duplicate products for every combination.

## Supported item types

The standard catalogue presents six general item types:

1. Stocked product
2. Service
3. Custom production item
4. Rental asset
5. Bundle
6. Non-stock item

Existing specialist and sports-shop item types remain readable and editable. Phase 7 does not rewrite or delete their historical values.

## Exact option fields

Each product variant can record any relevant combination of:

- Size
- Colour
- Material
- Model
- Capacity
- Unit
- Condition
- Duration
- Custom `Label: Value` attributes

Examples include:

- Size XL · Colour Black · Material Cotton
- Model GX-20 · Capacity 2 TB · Condition Refurbished
- Unit Metre · Colour White · Material Vinyl
- Duration 3 days · Model Excavator 320
- Voltage 240 V · Wattage 1200 W

Option values are normalized before storage. Duplicate option combinations within one item are rejected using a stable, case-insensitive signature.

## Data compatibility

No destructive database migration is required. Existing `ProductVariant.attributes` JSON remains the source of truth. Existing size and colour attributes continue to work, while the editor exposes the larger generic option set.

Archived options remain excluded from active inventory. Existing variant IDs, SKUs, stock quantities, price overrides and order-item relationships remain intact.

## Catalogue workflow

The item editor now:

- Requires a clear item type while retaining unfamiliar historical values.
- Supports up to 80 exact option rows per item.
- Tracks stock, SKU and optional price override for each option.
- Preserves custom attributes when an item is edited.
- Generates a SKU from the item and option combination when staff leave SKU blank.
- Prevents duplicate exact combinations.
- Keeps service rows available without ordinary stock limits.

## POS workflow

The POS now shows one card per catalogue item rather than one product card per variant.

When an item has multiple options:

1. Staff tap the grouped item card.
2. ESM opens an explicit option selector.
3. Every active option is shown.
4. Zero-stock options remain visible but disabled.
5. The selected option receives a strong border, highlight, checkmark and selected summary.
6. The add button remains disabled until an available option is selected.
7. Personalization begins only after the exact option is chosen.

ESM never silently selects the first option.

## Downstream accuracy

The selected option label is carried through:

- POS cart
- Production order board
- Thermal receipt
- Customer order-tracking page

The order continues to store the exact `ProductVariant` ID, so stock decrement, pricing and historical reporting use the same selected record.

## Safety and tenant isolation

- Catalogue reads and writes remain restricted to the signed-in shop.
- POS checkout still verifies that every submitted variant belongs to the current shop.
- Stock is decremented atomically against the exact selected variant.
- Unavailable options cannot be added through the selector.
- Existing idempotency, payment, discount and subscription checks are unchanged.

## Verification

Permanent verification includes:

- Unit coverage for option normalization, signatures, custom attributes, labels and archived variants.
- Structural regression checks for grouped POS and downstream option display.
- A dedicated disposable browser owner and multi-option product.
- Mobile Chromium acceptance proving grouped item display, disabled unavailable options, explicit selection and exact cart labeling.
- Full lint, TypeScript, unit, tenant-isolation, production-build and Chromium gates before merge.
