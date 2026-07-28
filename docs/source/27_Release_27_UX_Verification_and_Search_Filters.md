# Release 27 — UX Recovery, Buyer Verification and Search Filters

## Purpose

Release 27 stabilises the production user experience before Paystack is configured. It responds to reported administrator navigation problems, buried buyer registration, failed phone verification, absent email verification and weak discovery controls across the marketplace.

Paystack configuration and live payment testing are explicitly outside this release.

## Confirmed findings

### Administrator shell

- The desktop navigation list did not own a scrollable `flex-1` region. On shorter screens, the signed-in account card, Personal security and Sign out controls could be pushed below the visible viewport.
- The mobile Tools drawer contained navigation links but no Personal security or Sign out footer.
- The mobile header hid Sign out below the `sm` breakpoint.
- The page-help actions used wrapping flex controls that could become compressed or visually uneven on narrow screens.

### Buyer registration

- Existing-buyer login and new-account registration were presented on one long page.
- Registration appeared after the complete password-login section, which made Create account difficult to discover on phones and during checkout.
- The cart sent unauthenticated customers to buyer login without a dedicated registration route.

### Phone OTP and Arkesel

- Buyer registration creates a six-digit code in the application database and sends it using the configured SMS provider.
- Ghana local numbers such as `024...` were sent to Arkesel without conversion to international `233...` digits.
- The Arkesel V2 sender response parser did not read the documented `data[]` message UUID response.
- Provider credentials can be checked through the existing read-only Arkesel balance health check.
- A successful provider acceptance is not the same as final handset delivery. Delivery-status callbacks remain a later messaging-operations enhancement.

### Email/Gmail OTP

- Email is currently optional buyer metadata.
- No email verification-code model, email OTP action or transactional email provider exists in the current production code.
- Therefore Gmail OTP is not a broken existing feature; it must be introduced as a new secure verification channel.
- Gmail addresses can receive OTP messages from a transactional email provider. Provider credentials must remain in Railway and never enter GitHub or administrator notes.

## Delivery slices

### Slice A — Administrator visibility

- Make desktop navigation independently scrollable.
- Keep the signed-in account card, security control and Sign out footer visible.
- Add Personal security and Sign out to the mobile Tools drawer.
- Add a permanent administrator-help shortcut in the mobile header.
- Stack page-guide actions cleanly on small screens.

### Slice B — Buyer account visibility

- Separate existing-buyer login from buyer registration.
- Add `/buyer/register` as the clear new-customer route.
- Keep Create account visible near the top of buyer login and marketplace pages.
- Preserve the intended checkout destination through login and registration.
- Keep verification codes out of URLs, dashboards, logs and exports.

### Slice C — Arkesel OTP hardening

- Convert Ghana local recipients to international digits only at the provider boundary.
- Parse and store the real Arkesel V2 message UUID.
- Reject malformed success responses and invalid-number-only responses.
- Preserve rate limiting, hashed codes, expiry, attempt limits and one-time consumption.
- Add permanent unit and browser tests.

### Slice D — Email verification

- Add a dedicated hashed email-verification record with expiry, attempt count and one-time consumption.
- Use a transactional email provider with a Railway-only API key and verified sending domain.
- Support Gmail and other valid recipient addresses.
- Add provider health, rate limits, generic public errors and idempotent sending.
- Do not allow email verification to weaken required phone verification for pickup, delivery and account recovery until policy is explicitly changed.

### Slice E — Search and filter rollout

#### Public marketplace — first priority

- keyword: shop, product, brand, team, sport and category
- location/city
- category
- ordering availability
- sort by name, newest or catalogue size
- visible result count, active-filter chips and Clear filters

#### Individual shop storefront — next priority

- keyword: product, SKU, team, brand, sport and category
- category
- brand
- sport
- in-stock/service availability
- price range
- sort by relevance, name, newest, lowest price or highest price

#### Buyer account areas

- orders by shop, order number, fulfillment, payment status and date
- messages by shop and unread state
- returns by status and date
- cart by shop

#### Shop operations

- products/inventory: keyword, category, brand, condition, stock state and price
- customers: name, phone, email, group, debt state and activity date
- orders: receipt/order number, customer, channel, fulfillment, payment, status and date
- debts: customer, overdue state, amount range and due date
- messages: channel, direction, status, customer and date
- suppliers/orders: supplier, status, expected date and amount
- reports/audits: date, user, action, branch/shop context and export-safe filters

#### Platform administration

- shops: name, Login ID, verification, subscription, storefront state, city and date
- applications: existing reference/type/status/reviewer filters plus date and duplicate indicators
- support cases: reference, category, priority, status, assignee, shop and date
- activity/security: action, actor, entity, shop, result and date
- billing/communications: shop, package, channel, payment status, wallet event and date

## Standard filter behaviour

Every filter surface should follow the same rules:

1. Store state in URL query parameters so refresh, Back and shared links work.
2. Enforce tenant scope in the database query before applying user filters.
3. Use allow-listed sort fields and enums; never pass raw query text into SQL.
4. Show result count, active filters and one Clear filters action.
5. Use full-width stacked controls on phones and a compact grid on desktop.
6. Preserve filters when opening a detail and returning to the list where practical.
7. Add pagination before a list can grow without a safe upper limit.
8. Add database indexes for frequently combined tenant, status and date filters.
9. Test empty results, special characters, long values, mobile width and cross-tenant attacks.

## System review boundaries

The current GitHub validation suite remains the code-quality source of truth. Runtime provider health must be checked from `/admin/integrations` after Railway deployment. A green build does not prove that an external key, sender ID, balance, DNS record or webhook is operational.

## Release gate

Release 27 must remain draft until dependency audit, Prisma generation/migrations, lint, TypeScript, complete unit tests, tenant-isolation attacks, documentation generation, production build and desktop/mobile Chromium journeys all pass.
