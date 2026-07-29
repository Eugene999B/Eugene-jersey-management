# Release 38 — Subscription Billing Operations

## Objective

Turn assigned subscription contracts into a complete, auditable billing workflow for shop owners and the platform administrator.

Release 37 established immutable contracts, plan limits, feature entitlements, renewal dates, grace periods and suspension rules. Release 38 adds the commercial records and payment flow needed to collect, reconcile and prove subscription payments safely.

## Scope

### Subscription invoices

- Create immutable subscription invoices from the assigned `ShopSubscriptionContract` snapshot.
- Store invoice number, shop, contract, plan version, billing cycle, service period, issue date, due date, subtotal, tax, total, currency and status.
- Prevent duplicate invoices for the same shop and service period.
- Preserve historical invoices when plan catalogue prices change.
- Support PDF download for shop owners and the platform administrator.

### Subscription payments

- Create a pending payment attempt before redirecting to Paystack.
- Use platform-owned Paystack checkout; subscription revenue must not settle to a shop subaccount.
- Verify provider reference, amount and currency before marking an invoice paid.
- Make callback and webhook processing idempotent.
- Record provider transaction ID, channel, gateway response, verification time and raw provider metadata needed for reconciliation.
- Never mark a subscription active from an unverified browser redirect alone.

### Owner renewal and upgrade flow

- Show the current invoice, due amount, due date and payment history under Dashboard → Subscription & usage.
- Allow an owner to pay an issued invoice through Paystack.
- Allow an owner to request a plan or billing-cycle change without silently changing the active contract.
- Apply approved changed terms only after payment or explicit administrator override.

### Renewal and dunning operations

- Generate the next invoice before renewal using the immutable contract price.
- Mark unpaid invoices overdue after the due date.
- Send reminder notifications before due date, on due date and during grace.
- Move the contract to PAST_DUE only through the lifecycle processor.
- Suspend commercial writes only after the configured grace deadline.
- Avoid duplicate reminders by recording every dunning event.

### Administrator reconciliation

- Add invoice and payment status filters to Admin → Subscription Plans & Billing.
- Show outstanding amount, last payment, next renewal and failed attempts per tenant.
- Support audited manual actions: record external payment, void invoice, retry verification and extend due date.
- Require a written reason for every manual commercial override.

## Data-safety rules

- Existing contracts, products, orders, customers and shop payments are not rewritten.
- Subscription billing receives separate tables from customer order `Payment` records.
- Every provider reference is globally unique.
- Invoice amount and currency come from the immutable contract snapshot, not the current plan catalogue.
- Successful payment processing is serializable and idempotent.
- Refunds and chargebacks do not delete the original payment record.
- Tenant code uses scoped access; cross-tenant reconciliation remains platform-only.

## Planned records

- `SubscriptionInvoice`
- `SubscriptionPaymentAttempt`
- `SubscriptionDunningEvent`
- `SubscriptionChangeRequest`

## Validation

Release 38 is complete only after:

- migration validation
- dependency audit
- lint and TypeScript
- unit tests for invoice generation, payment verification and lifecycle dates
- two-shop tenant-isolation verification
- production build
- Chromium acceptance for owner renewal and administrator reconciliation
- controlled Paystack test-mode payment before live collection is enabled
