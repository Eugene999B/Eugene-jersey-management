# Release 38 — Subscription Billing Operations

## Objective

Release 38 completes the commercial collection path begun in Release 37. Configured immutable subscription contracts can now produce invoices, collect renewal payments through the platform Paystack account, record every attempt, issue downloadable PDFs, send reminders, reconcile provider references and activate the next term only after verified settlement or an explicit audited administrator decision.

## Additive database design

The release adds two platform-owned records:

- `SubscriptionInvoice` stores the shop, contract, plan version, billing cycle, price, currency, coverage period, due date, status and reminder history.
- `SubscriptionPaymentAttempt` stores the invoice, platform provider, unique reference, expected amount, currency, checkout URL, verification result, provider transaction identity and failure message.

Invoices are unique for a shop and coverage period. Payment references are globally unique. Existing shops, contracts, products, customer orders and order payments are not rewritten by the migration.

The new models remain platform-commercial records. Tenant dashboard code reaches them through the reviewed subscription-billing repository rather than importing the unrestricted platform database client.

## Invoice generation

A renewal invoice copies its commercial terms from the exact `ShopSubscriptionContract` snapshot assigned to the shop:

- plan name and version
- monthly or yearly billing cycle
- saved price and currency
- coverage start and end
- renewal due date
- immutable terms snapshot

The daily processor creates an invoice when the renewal or trial deadline enters the configured lead window. The default lead time is 14 days and can be adjusted with `SUBSCRIPTION_INVOICE_LEAD_DAYS` from 1 to 60 days.

Owners and platform administrators may also request the current renewal invoice manually. The unique shop-period key makes repeated requests idempotent.

Free or zero-value contracts do not create a Paystack invoice.

## Owner renewal flow

`Dashboard → Subscription & usage` now includes an invoice and payment-history centre.

An owner can:

1. generate or locate the current renewal invoice;
2. review amount, plan version, due date and coverage period;
3. download the invoice PDF;
4. start secure Paystack checkout;
5. review pending, failed and successful payment attempts;
6. see the next subscription term activate after verification.

Only the owner can start subscription payment. Managers and other authorised staff can still review the subscription state and usage.

A recent pending checkout URL is reused for 30 minutes so double-clicks and repeated form submissions do not create unnecessary payment attempts.

## Paystack settlement

Subscription payments use the platform-owned Paystack transaction path. They do not require a shop subaccount because the payment belongs to Eugene Shop Management rather than to a customer order.

Paystack metadata identifies the purchase as `subscription_invoice` and includes the invoice, attempt, shop and invoice number.

Both browser callback and signed webhook processing call the same settlement function. The function verifies:

- transaction status is successful;
- provider amount exactly matches the invoice amount in subunits;
- provider currency matches the invoice currency;
- invoice has not been voided;
- payment reference belongs to a recorded subscription attempt;
- the attached subscription contract still exists and has not been cancelled;
- the invoice period has not already been covered by a later renewal.

Settlement runs in a serializable database transaction. A successful result:

- marks the payment attempt successful;
- marks the invoice paid;
- sets the contract and shop status to `ACTIVE`;
- clears trial and grace deadlines;
- advances renewal from the current due base without shortening an administrator-adjusted deadline;
- writes a shop audit record;
- sends the owner a payment receipt through configured email and SMS channels.

Duplicate webhook or callback processing returns the already-verified result without extending the term twice. A payment cannot reactivate a cancelled contract. A payment for an invoice period already covered by a later renewal is recorded as failed and sent for refund or manual reconciliation.

Monthly and yearly periods preserve the intended calendar day where possible. Month-end renewals clamp to the last valid day of shorter months, including leap-year handling, rather than skipping into the following month.

## Provider event routing

The shared Paystack webhook keeps one signed, idempotent event register. Successful charge events are resolved in this order:

1. communication-credit purchase;
2. subscription invoice payment;
3. customer-order payment.

Each settlement function returns an explicit not-found reason before the event is offered to the next payment domain. This prevents one reference from being processed as two different purchases.

## Invoice PDF

Authenticated owners and authorised platform billing administrators can download a PDF from:

`/api/subscription-invoices/{invoiceId}/pdf`

The PDF includes invoice number, shop, plan version, status, amount, due date, billing cycle, coverage period and recorded payment attempts. A tenant account cannot retrieve another shop’s invoice.

## Dunning and reminders

The existing daily command remains the only required subscription scheduler:

```bash
npm run jobs:subscriptions
```

After lifecycle state synchronisation, the command now also:

- marks open invoices overdue after their due instant;
- creates invoices inside the configured lead window;
- sends reminders whose `nextReminderAt` is due;
- records reminder count, last reminder and next reminder;
- writes an audit event for every attempted reminder.

Upcoming invoices are reminded weekly. Overdue invoices are reminded every three days. Paid and void invoices are never reminded.

Email uses the configured transactional Gmail or Resend provider. SMS uses the existing configured direct provider path. Missing contact details are reported to the administrator instead of guessing a recipient.

## Administrator command centre

`Admin → Subscription invoices` provides:

- open, overdue and failed-attempt indicators;
- outstanding and paid value summaries;
- shop and status filters;
- invoice issue or lookup;
- immediate lifecycle and dunning processing;
- PDF download;
- reminder dispatch;
- Paystack reference reconciliation;
- payment-attempt history;
- audited manual payment recording;
- audited invoice voiding.

Manual payment and void actions require a written operational reason of at least eight characters.

A manual settlement creates a successful `SubscriptionPaymentAttempt` with provider `manual`, activates the next term, sends a receipt and writes the administrator identity, reason and resulting renewal date to the audit log. It cannot reactivate a cancelled contract or shorten a later renewal date.

A paid invoice cannot be voided. Voiding an open or overdue invoice closes pending attempts so an old checkout cannot be treated as normal settlement later. A payment arriving for a void invoice is marked failed for manual reconciliation rather than activating service.

## Production configuration

Required for live subscription collection:

- `PAYSTACK_SECRET_KEY`
- `APP_URL` using the production HTTPS origin
- Paystack webhook URL pointing to `/api/paystack/webhook`

Recommended for reminders and receipts:

- transactional email configuration through Gmail or Resend;
- Arkesel or another configured SMS provider;
- owner email and phone maintained in shop credentials.

Railway should continue to run `npm run jobs:subscriptions` once daily. No second billing cron is required.

## Validation

Permanent validation covers:

- monthly and yearly renewal calculation, including month-end and leap-year clamping;
- due versus overdue status boundaries;
- immutable invoice period uniqueness;
- globally unique payment references;
- platform purchase-type metadata;
- signed webhook routing order;
- serializable settlement and audit requirements;
- cancelled-contract and already-covered-period settlement guards;
- explicit manual-decision reasons;
- owner invoice and payment-history experience;
- administrator reconciliation command centre;
- narrow mobile subscription billing layout;
- authenticated PDF ownership boundaries through route architecture.

The release must pass database migrations, dependency audit, retired-credential scanning, lint, TypeScript, the complete unit suite, two-shop tenant isolation, generated documentation, production build and all Chromium acceptance tests before merge.
