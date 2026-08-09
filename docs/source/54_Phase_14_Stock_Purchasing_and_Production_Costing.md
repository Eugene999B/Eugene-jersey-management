# Phase 14 — Stock, purchasing and production costing

Phase 14 connects physical production stock, supplier purchasing, material waste and job profitability to the production workflow introduced in Phases 11–13.

## Operator outcome

The shop can now answer four questions from durable records instead of memory or handwritten notes:

1. How many exact garments are available by colour and size?
2. How many metres of a vinyl/material roll remain after production use and waste?
3. What does the shop currently owe each supplier after goods received, payments and return credits?
4. What did a reviewed production job truly cost, and what profit/margin did it earn?

## Exact production inventory

Production stock is separate from, but can be linked to, the existing catalogue stock system.

Supported stock kinds are:

- garments,
- vinyl,
- transfer sheets,
- packaging,
- consumables,
- finished goods.

Garments should normally use `PIECE` and one stock row for each real colour/size option. Vinyl should normally use `METRE`, so the remaining roll length can be reduced by actual production use and separately recorded waste.

A production stock item can also reference:

- a stable Phase 11 garment/material resource ID,
- an existing catalogue `ProductVariant`,
- both, or neither.

This keeps exact shop-floor inventory auditable without breaking existing catalogue/POS stock.

## Stock ledger and concurrency safety

Every quantity change writes a `ProductionInventoryMovement` containing:

- movement type,
- signed quantity delta,
- balance after the movement,
- unit-cost snapshot,
- reference type and ID,
- operator,
- timestamp,
- optional idempotency key.

The shared movement service locks the affected PostgreSQL inventory row with `FOR UPDATE` before reading and changing its balance. Concurrent use, waste, return or adjustment requests therefore serialize against the latest quantity instead of racing on a stale balance.

Outbound movements are rejected when they would make the stock balance negative.

## Purchasing and goods received

The existing supplier and purchase-order workflow remains authoritative. Phase 14 extends it rather than creating a second purchasing system.

When creating a purchase-order line, the operator can link it to:

- an existing catalogue variant,
- an exact production stock item,
- both,
- or neither.

When the purchase order is received, one transaction:

1. claims the order so it cannot be received twice,
2. increments existing catalogue variant stock where linked,
3. posts `PURCHASE_RECEIPT` to production stock where linked,
4. recalculates weighted average production unit cost,
5. records supplier item cost history,
6. creates a goods-received note,
7. records the supplier purchase/payable entry.

If any part fails, the transaction rolls back.

## Supplier balances, payments and returns

Supplier account entries use signed amounts:

- `PURCHASE` adds to the amount owed,
- `PAYMENT` reduces the amount owed,
- `RETURN_CREDIT` reduces the amount owed,
- `ADJUSTMENT` is reserved for explicit controlled corrections.

Returning production stock to a supplier is one transaction that:

- creates the supplier-return record,
- deducts the returned quantity from production stock,
- writes the stock movement,
- records a supplier return credit.

The production-stock workspace shows the current aggregate supplier balance and recent purchasing evidence.

## True production cost and profit

Each reviewed `DesignProductionBrief` can receive one `ProductionCostSnapshot` containing:

- exact garment cost,
- material used in metres,
- material waste in metres,
- used-material cost,
- waste cost,
- labour cost,
- design cost,
- pressing cost,
- additional service cost,
- total cost,
- revenue,
- profit,
- margin percentage.

The garment and material unit costs come from the exact production inventory rows chosen for the job, so supplier receiving and weighted cost changes feed forward into later costing.

## Costing is deliberately separate from stock posting

Saving or recalculating a cost snapshot **does not deduct stock**.

The operator must explicitly use **Post garment, material use and waste to stock**. That action:

- consumes exactly one selected garment,
- consumes the saved material-used metres,
- posts the saved waste metres as `WASTE`,
- marks the cost snapshot as inventory-posted.

Each movement has a stable idempotency key derived from the cost snapshot, and a posted snapshot cannot be edited or posted a second time. This prevents double-deduction from repeat clicks, retries or browser refreshes.

## Manual stock movements

Authorized inventory/purchasing roles can explicitly record:

- waste,
- damage,
- stock adjustment in,
- stock adjustment out,
- finished-good production in.

Every manual movement requires a reason and becomes part of the stock ledger.

## Roles and tenancy

Production-stock and supplier mutations are always scoped to the signed-in shop.

- Supplier/purchasing and stock operations use the existing supplier/purchasing permissions and module gate.
- True production costing is restricted to owner, manager or accountant roles and the printing/production module.
- Cross-shop supplier, catalogue variant, production item and reviewed-job IDs are rejected.

## Recommended daily workflow

1. Create exact garment/vinyl stock rows for the real shop inventory.
2. Create purchase orders in **Suppliers** and link PO lines to the relevant production stock rows.
3. Use **Receive & post stock** only after physical goods are counted.
4. Record supplier payments and any supplier returns.
5. Complete the design → guided production → cutter → heat press workflow.
6. In **Production stock & true job cost**, select the exact garment and material used.
7. Enter actual material use, waste, labour and service costs.
8. Review cost, revenue, profit and margin.
9. Post consumption once the physical job has actually used the stock.
10. Investigate low-stock warnings and reorder before the next production run.

## Data-safety guarantees

Phase 14 is additive. It does not delete or rewrite historical orders, design jobs, reviewed production snapshots, heat-press attempts or existing catalogue stock records.

Purchase receiving preserves the existing catalogue stock increment behavior while adding production-ledger evidence. Production costing remains a snapshot so later supplier-price changes do not silently rewrite historical job profitability.
