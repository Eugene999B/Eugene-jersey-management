# Paystack Refunds and Reconciliation

## Purpose

ESM records Paystack refunds as a durable financial ledger instead of overwriting the original captured payment. This preserves the original transaction evidence while allowing partial refunds, full refunds, asynchronous provider processing, failed refunds and reconciliation-required outcomes to be represented accurately.

## Authority

Only shop `OWNER`, `MANAGER` and `ACCOUNTANT` roles may issue, reconcile or retry a Paystack refund. Cashiers and other staff can retain their existing order/payment visibility but cannot create refund outflows.

Platform administrators have read-only refund exception visibility in `/admin/integrations`. The platform view is intended for provider health and investigation; it does not bypass tenant refund authority.

## Refund ledger

`PaymentRefund` stores:

- the owning `shopId` and `paymentId`;
- the original Paystack transaction reference;
- requested amount and currency;
- local and provider status;
- provider refund ID/reference when available;
- reason and customer/merchant notes;
- requesting user ID;
- provider response evidence and failure message;
- requested, updated, failed and processed timestamps.

Customer bank account details used for a Paystack `needs-attention` retry are not stored in the refund ledger or audit metadata. They are sent only to Paystack for that retry operation.

## State model

ESM supports these durable states:

- `REQUESTED` — local refund capacity has been reserved before the provider request.
- `PENDING` — Paystack accepted the refund and it is waiting for processing.
- `PROCESSING` — provider processing is in progress.
- `NEEDS_ATTENTION` — Paystack requires verified customer bank details before it can continue.
- `RECONCILIATION_REQUIRED` — ESM cannot safely determine whether the provider accepted the refund. Another refund must not be started until the original outcome is reconciled.
- `FAILED` — the provider definitively rejected or failed the refund; its reserved capacity is released.
- `PROCESSED` — the refund completed and reduces recognized payment value.

A payment can have multiple historical partial refunds, but ESM permits only one active refund at a time for a payment. This makes provider webhook matching deterministic even when the provider does not initially supply a refund reference.

## Over-refund and network safety

Refund capacity is reserved inside a serializable database transaction before ESM contacts Paystack. Existing processed and active refunds are deducted from the amount still refundable.

A definitive provider rejection marks the refund `FAILED`. A network timeout, connection failure or ambiguous 5xx response does **not** automatically retry. It moves the refund to `RECONCILIATION_REQUIRED` so the operator can query Paystack for the original outcome. This prevents a second request from accidentally creating a duplicate refund.

## Reconciliation

For a reconciliation-required refund, ESM first uses the known Paystack refund ID when available. If the refund ID is not known, ESM verifies the original transaction and searches its refund records for a unique amount/currency match. If no unique match can be proven, the refund remains blocked for manual provider review.

`NEEDS_ATTENTION` refunds show a Ghana bank list and customer account-number form in the tenant order control room. The bank details are sent to the Paystack retry endpoint and are not persisted by ESM.

## Webhooks

The Paystack webhook endpoint continues to process existing `charge.success` events for store payments, subscription invoices and communication-credit purchases. Refund events have a separate event identity and update the refund ledger without interfering with charge settlement.

When a refund webhook is processed, ESM updates both:

1. the `PaymentRefund` provider state; and
2. the original payment's refund accounting metadata.

A previously `PROCESSED` refund cannot be rolled backward by a later stale non-processed webhook.

## Payment accounting

The original `Payment.amount` remains the captured gross amount. ESM writes the total amount of processed refunds to payment metadata as `refundProcessedAmount`.

For a partial refund, the payment remains `SUCCESS`, and recognized value is:

`gross captured amount - processed refund amount`

For a full refund, the payment becomes `REFUNDED`, and recognized value is zero.

Only `PROCESSED` refunds reduce recognized value. Pending, processing, needs-attention and reconciliation-required refunds remain reserved but do not reduce financial truth until provider completion is confirmed.

## Operational surfaces

The order control room shows gross payment, processed refund total, net recognized amount and remaining refundable capacity. It contains the tenant refund, reconciliation and needs-attention retry controls.

Printed receipts show the original payment plus the refunded and net amounts. Order balance/deposit calculations use net recognized payment. Management payment totals and outstanding balances use the same refund-adjusted accounting.

Daily closing card and mobile-money values are net of processed Paystack refunds. The manual `refunds` field in daily closing is for **cash/manual refund outflows only**. Operators must not enter Paystack card or mobile-money refunds there because those have already been deducted automatically.

## Backup and rollback protection

The Phase 17 backup/restore rehearsal now seeds a deterministic Paystack payment with a processed partial refund and includes both records in its canonical SHA-256 fingerprint. The release gate therefore proves that the refund ledger, payment metadata and net financial truth survive PostgreSQL dump/restore alongside order and production data.

## Automated acceptance fixture

Browser acceptance seeds a disposable GH₵80 card payment with a GH₵20 processed refund. The expected truth is:

- captured gross: GH₵80;
- processed refund: GH₵20;
- recognized/net paid: GH₵60;
- order balance reopened by the refund: GH₵20;
- remaining refundable capacity: GH₵60.

The browser suite verifies the tenant order surface, mobile horizontal-overflow safety and platform refund reconciliation visibility without calling the live Paystack API.

## Production commissioning boundary

CI verifies migrations, state transitions, accounting calculations, tenant scoping, backup/restore preservation and browser UX using deterministic data. It does not issue a real refund against production Paystack credentials.

Before broad commercial enablement, perform one controlled real transaction/refund test using the verified production Paystack account/subaccount and confirm the provider webhook lifecycle, settlement impact and bank-detail retry path if applicable. Record the result in the production commissioning tracker.
