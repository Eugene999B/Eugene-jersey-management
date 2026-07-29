# Release 37 — Commercial Launch Hardening

## Objective

Release 37 turns the saved subscription catalogue into enforceable commercial controls before the platform accepts paying shops. The release focuses first on access state, product capacity, monthly order capacity, feature entitlements and transparent usage. Subscription invoices, payment collection and automated dunning continue in the next commercial hardening phase.

## Legacy-safe rollout

Existing production shops are not silently locked because an old plan row happens to contain placeholder terms.

Commercial enforcement starts only when a shop has a `ShopSubscriptionContract` whose immutable `termsSnapshot` is marked as configured. Shops without that configured contract retain legacy access until the platform administrator deliberately assigns approved terms.

Once a configured contract is assigned, its saved version becomes authoritative for:

- trial and grace days
- product limit
- monthly order limit
- included staff accounts
- feature entitlements
- monthly and yearly prices

Later edits to the general plan catalogue do not silently change an existing tenant contract.

## Operational subscription states

The shared subscription engine derives the effective state from the recorded status and contract dates:

- `TRIAL` remains operational until the trial deadline.
- `ACTIVE` remains operational until the renewal deadline.
- An elapsed trial or renewal deadline enters `PAST_DUE` grace access.
- `PAST_DUE` remains operational only until the saved grace deadline.
- An expired grace period derives `SUSPENDED` commercial access.
- Explicit `SUSPENDED` and `CANCELLED` states block new commercial operations.

A suspended shop can still open its Subscription & usage page. Owners and managers can also reach Shop Settings so that payment and contact information can be corrected. Product creation, POS checkout, public checkout and cart checkout remain blocked until the subscription becomes operational again.

## Product and order limits

Product creation checks the assigned `maxProducts` value before uploads and database writes begin. The product database trigger performs the same check inside the transaction with a shop-specific advisory lock, preventing concurrent requests from exceeding the limit.

The assigned `maxOrdersPerMonth` value is enforced across every customer-order route:

- shop POS checkout
- public single-product checkout
- buyer cart checkout

The monthly period is the UTC calendar month. Existing orders remain visible and are never deleted when a limit is reached. A limit blocks only the creation of the next order.

Duplicate checkout requests are resolved through their idempotency keys before a new plan slot is consumed.

## Feature entitlements

Configured feature lists control the corresponding shop modules:

| Plan feature | Controlled area |
| --- | --- |
| `STOREFRONT` | Public ordering and Online selling |
| `POS` | Sales & POS |
| `INVENTORY` | Products & stock |
| `DESIGN_STUDIO` | Design Studio |
| `SUPPLIERS` | Supplier operations |
| `SHOP_NETWORK` | Partner-shop network |
| `CUSTOMER_MESSAGING` | Customer Messages |
| `ADVANCED_REPORTS` | Reports and Export centre |

An empty feature list remains migration-compatible for an older contract. Once the administrator saves explicit feature selections and assigns that version, those selections are enforced.

Role permissions and plan entitlements are separate controls. A user must have both the correct staff role and a plan that includes the requested module.

## Tenant Subscription & usage centre

`Dashboard → Subscription & usage` shows:

- assigned plan and immutable version
- recorded and effective status
- billing cycle and saved price
- trial, renewal and grace deadlines
- current products versus product limit
- orders created this month versus monthly limit
- active staff plus unexpired invitations versus included staff slots
- included and excluded plan features

The page explains that an invitation reserves a staff slot even before the invited person accepts it.

## Administrator billing register

`Admin → Subscription Plans & Billing` now displays live usage beside each tenant contract:

- products used / allowed
- orders this month / allowed
- staff accounts and pending invitations / allowed
- plan version
- cycle and price
- renewal and grace dates
- status

This makes over-capacity and renewal decisions visible before the administrator changes a plan.

## Lifecycle processor

Run the lifecycle processor with:

```bash
npm run jobs:subscriptions
```

The processor validates every immutable contract snapshot, derives the effective state, synchronises the contract and legacy shop status fields, and writes an audit record whenever the status or calculated grace deadline changes.

For production, configure this command as a Railway Cron service once per day. It is safe to run more than once because unchanged contracts are not rewritten.

The request-time and database controls do not rely solely on the scheduled job. Even when the cron service is delayed, an expired contract is evaluated before a new commercial record is created.

## Database safety

Release 37 adds functions and `BEFORE INSERT` triggers; it does not rewrite existing products or orders.

The migration:

- leaves shops without configured contracts unchanged
- does not delete or archive any product
- does not cancel any historical order
- does not change stock quantities
- does not change payment records
- uses transaction-level advisory locks only while a new product or order is being inserted

## Validation

Permanent tests verify:

- legacy access remains available before configured assignment
- trial, active, grace, suspended and cancelled state derivation
- stable calendar-month order windows
- explicit feature inclusion
- shared enforcement in every product and checkout route
- database trigger backstops and error identifiers
- tenant and administrator usage pages
- the auditable lifecycle command

The release must also pass database migrations, dependency audit, lint, TypeScript, the complete unit suite, two-shop tenant-isolation verification, production build and Chromium browser acceptance before merge.
