# Phase 8 — POS and payment redesign

## Purpose

Phase 8 makes the point of sale reconcile the complete order total before checkout. Staff can use one payment method or combine cash, card, mobile money and store credit without losing the exact amount assigned to each method.

## Payment truth

Every checkout must satisfy one invariant:

> The sum of all payment allocations must equal the final order total exactly.

ESM calculates in minor currency units to avoid floating-point rounding errors. Checkout remains disabled until the payment plan balances.

## Supported tenders

- Cash
- Card
- Mobile money
- Store credit

Each method can appear only once in one payment breakdown. A sale can use one method or a mixed combination of the four methods.

## Cash handling

Cash records:

- Amount allocated to the sale
- Cash physically received
- Change due

Cash received cannot be lower than the allocated cash amount. Change is calculated automatically and appears in the checkout confirmation, audit metadata and receipt.

## Card and mobile money

Every card or mobile-money allocation requires:

- The exact amount
- A terminal or network reference
- Staff confirmation that the amount was received

The same external reference cannot be reused inside a payment breakdown or reused by another successful payment in the same business.

## Partial credit

Store credit can cover the full total or only part of it.

When credit is mixed with cash, card or mobile money:

- Successful tenders are saved as paid now.
- Only the store-credit allocation becomes debt.
- The due date and installment count apply only to that credit allocation.
- A customer is required whenever any credit amount exists.
- The customer’s previous outstanding balance is preserved and the new credit portion is added separately.

## Persistence

ESM creates one `Payment` record per tender. Phase 8 adds three backward-compatible fields to the existing payment table:

- `tenderedAmount` for cash physically received
- `changeAmount` for change returned
- `metadata` for structured tender facts

An additive index supports order/method/status reconciliation. Existing payment rows receive safe defaults and are not rewritten or deleted.

The payment record also retains:

- Method
- Allocated amount
- Status
- Provider reference
- Verification time
- Provider channel
- Structured gateway-response JSON for backward-compatible diagnostics

## Receipt

The thermal receipt now includes:

- Payment breakdown by method
- Allocated amount and status
- External reference where relevant
- Cash received
- Change
- Total paid now
- Credit balance

The item section continues to show the exact selected catalogue option from Phase 7.

## Compatibility

The checkout API accepts the new payment array and retains support for the legacy single-payment payload. Existing idempotency, tenant ownership, stock decrement, discount approval, customer matching, messaging and subscription checks remain active.

## Safety

- Payment allocations must balance exactly.
- Negative and zero tender amounts are rejected for non-zero orders.
- Duplicate methods are rejected.
- Cash shortages are rejected.
- Unconfirmed external payments are rejected.
- Duplicate external references are rejected.
- Debt is never created for the cash, card or mobile-money portions.
- Stock and order creation remain in one transaction.

## Verification

Permanent verification includes:

- Unit tests for cash/change, mixed payment, partial credit and invalid plans.
- Structural tests for server, POS and receipt integration.
- Mobile Chromium acceptance for a GHS 125 sale split into GHS 50 cash and GHS 75 mobile money, with GHS 60 cash received and GHS 10 change.
- Full migration, lint, TypeScript, unit, tenant-isolation, documentation, production-build and Chromium validation before merge.
