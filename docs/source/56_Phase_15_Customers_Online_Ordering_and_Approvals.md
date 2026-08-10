# Phase 15 — Customers, online ordering and approvals

Phase 15 connects the public marketplace to the production system without creating a second order or payment ledger. Ordinary storefront checkout remains unchanged; customizable work gains a quoted request/approval lifecycle before it becomes a financial order.

## Customer custom-production flow

A signed-in buyer can open a verified shop and submit a custom-production request with:

- an exact customizable product variant,
- a verified garment profile and exact size,
- a verified print placement,
- requested text or name,
- requested number,
- design notes,
- optional JPEG/PNG/WebP reference artwork,
- collection or delivery details.

Submitting the request does **not** create an `Order` and does **not** charge the buyer. The shop must prepare a quote and concept preview first.

## Durable snapshots

At submission ESM freezes the selected product, garment and placement data into the request. This prevents later catalogue or production-library edits from silently changing what the customer originally requested.

Customer artwork is stored durably in PostgreSQL with:

- original filename,
- MIME type,
- byte length,
- SHA-256,
- binary bytes.

Uploads are limited to 5 MB and accepted only when both MIME type and file signature match JPEG, PNG or WebP. Artwork is served through a high-entropy request access token with private/no-store caching, `nosniff` and sandbox response headers.

## Quote and preview

Owners, managers and designers can issue a quote and preview from the custom-production queue.

The quote records:

- quoted total,
- required deposit,
- preview version,
- preview note,
- optional quote expiry.

The generated concept preview is intentionally descriptive rather than machine-ready. It shows the garment, placement, requested text/number and operator note. Final physical output still follows the reviewed Design Studio → guided production → cutter → heat-press workflow.

Every new quote increments the preview version. A customer may approve the current preview or request changes. Requested changes return the job to the shop queue for another version.

## Approval boundary

A real `Order` is created only after the buyer explicitly approves a `PREVIEW_READY` request.

The created order:

- uses the existing online order channel,
- stores the quoted total,
- stores the exact personalization/request IDs,
- retains collection/delivery details,
- gets the normal ESM receipt/public access token,
- uses a stable request-derived idempotency key.

A zero-deposit quote immediately satisfies the deposit milestone when the preview is approved, so the request can move into production without a meaningless GH₵0 payment.

## Deposit and balance payments

Custom production uses the existing `Payment` and Paystack verification/settlement code.

The buyer page calculates milestones only from `SUCCESS` payments on the linked order.

- The deposit button charges only the remaining deposit amount.
- The balance button is unavailable until the deposit target is satisfied.
- The balance charge is only the unpaid remainder of the quoted total.
- Repeated Paystack callbacks remain idempotent through the existing settlement path.
- Payment initialization is fail-closed behind the existing rate limiter.

A provider redirect or pending payment never counts as paid until Paystack verification and settlement succeed.

## Production tracking

The shop queue enforces milestone order:

1. buyer approves preview,
2. verified deposit milestone is reached,
3. shop starts production,
4. shop marks the job ready,
5. any remaining balance is paid,
6. shop completes the job.

The linked `Order` mirrors `PENDING → IN_PRODUCTION → READY → COMPLETED`, so Phase 15 does not create a competing fulfilment state machine.

The buyer request page shows timestamps for:

- request submission,
- preview approval,
- deposit received,
- production started,
- ready/completed,
- full balance payment.

It also shows the request event history, artwork and current quote/payment totals.

## Completion notifications

Preview-ready, ready and completed milestones use the existing customer messaging layer. SMS delivery therefore continues to respect shop communication configuration, credit balances and the existing provider integration. Notification failures are best-effort and do not corrupt the production transaction.

## General marketplace

The verified marketplace now explicitly supports offer filters for:

- products,
- services,
- rentals,
- custom production.

Existing category search, verified Ghana business location search, reviews and shop storefronts remain in place. Ordinary product/service/rental purchases still use the existing exact-variant checkout, pickup/delivery and review system.

Customizable marketplace listings link into the custom-production request flow instead of pretending a quoted design job is an ordinary instant checkout.

### Location versus distance

The current business schema has verified Ghana registration region/district/town data but no trustworthy per-business latitude/longitude. Phase 15 therefore keeps honest location search and **does not invent GPS distance precision from town names**. Distance ranking should be enabled only after businesses have usable coordinates.

## Roles and tenancy

- Buyers can see and modify only requests owned by their buyer account.
- Customer artwork requires the matching request access token.
- Product variants, garment resources and placements must belong to the selected shop.
- Staff queue reads are shop-scoped.
- Quote/preview and production-stage mutations are limited to owner, manager or designer roles.
- Order/payment queries remain bound to both shop and buyer identity.

## Operator workflow

1. Customer submits the exact custom-production request.
2. Open **Design Studio → Customer requests**.
3. Review notes and reference artwork.
4. Enter the quote, deposit and preview note.
5. Send the next preview version.
6. Wait for buyer approval or change request.
7. After approval, wait for verified deposit unless deposit is zero.
8. Start production and use the existing Design Studio/guided production/cutter/heat-press workflow.
9. Mark the job ready and notify the customer.
10. Confirm full verified balance.
11. Complete the linked order and notify the customer.

## Data safety

Phase 15 is additive. It does not rewrite historical storefront orders, payments, reviewed Design Studio production briefs, heat-press attempts or Phase 14 cost snapshots. A custom request becomes an ordinary order only at the explicit approval boundary, preserving both pre-order quote history and the authoritative financial ledger.
