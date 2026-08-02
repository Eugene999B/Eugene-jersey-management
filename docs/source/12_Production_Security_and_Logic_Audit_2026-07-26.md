# Eugene Shop Management - Production Security and Logic Audit

**Audit date:** 26 July 2026  
**Branch:** `agent/full-system-hardening-and-brand`  
**Pull request:** `#3`

## Executive Result

This audit reviewed authentication, session persistence, role enforcement, tenant isolation, stock movement, reservations, supplier and network operations, payment settlement, one-time codes, messaging, media storage, reporting, public routes, onboarding, branding, documentation and CI controls.

The refresh-to-login defect was addressed by removing full JWT authority from Next.js Proxy. Proxy now performs only an optimistic cookie-presence redirect. Protected layouts, route handlers and server actions remain authoritative and validate the signed token, database user, account activity, session version, tenant state and role.

The audit found and fixed multiple high-risk logic defects that could otherwise cause cross-tenant relationships, duplicated stock movement, unpaid orders being completed, double stock restoration, coupon-count corruption, inconsistent payment settlement, OTP disclosure in message history, production media loss and credential exposure.

## Critical and High-Risk Findings Fixed

### 1. Refresh caused false logout

**Risk:** Browser refresh could redirect valid users to login because Proxy attempted authoritative token verification in an environment where false negatives erased access.

**Fix:**

- Added durable HTTP-only, same-site, high-priority cookies with explicit expiry.
- Reduced Proxy to cookie-presence routing only.
- Kept authoritative validation in protected server layouts and actions.
- Added session-cookie regression tests.

### 2. Cross-tenant catalogue relationships

**Risk:** Guessed IDs could attach a category to another tenant's attribute template or create products against another tenant's category.

**Fix:** Every submitted category, template, product and variant relationship is checked against the authenticated shop before mutation.

### 3. Duplicate supplier and partner-shop stock movement

**Risk:** Repeated receive or fulfil actions could increment or decrement stock more than once.

**Fix:** Supplier receiving and network fulfilment now atomically claim an eligible status before moving stock. Replayed actions cannot repeat the movement.

### 4. Reservation release races

**Risk:** Concurrent expiry jobs or cancellation paths could restore the same stock more than once. Coupon usage could remain inflated after an unpaid cancellation.

**Fix:** Added a shared serialisable reservation-release function that atomically claims the order, restores non-service stock once, fails pending payments, restores coupon usage once and records the audit event.

### 5. Unsafe order completion and cancellation

**Risk:** Pickup orders could be completed before payment and verification. Paid orders could be cancelled through a path designed for unpaid reservations.

**Fix:**

- Pickup release requires verification and successful payment or confirmed cash collection.
- Generic status updates cannot bypass fulfilment verification.
- Unpaid online cancellation uses the shared compensation path.
- Paid-order cancellation requires a separate refund-aware workflow.

### 6. Paystack settlement races and failed initialisation

**Risk:** Callback and webhook races could produce inconsistent payment state. Failed Paystack initialisation could leave stock and coupons reserved with no usable payment session.

**Fix:**

- Paystack settlement validates status, amount and currency.
- Settlement is serialised and idempotent.
- Webhook event records can be retried safely.
- Failed initialisation immediately compensates stock and coupon usage.
- Multi-item carts are preserved when payment initialisation fails.

### 7. One-time codes stored in message history

**Risk:** Verification and fulfilment codes could be written as plaintext customer messages and exposed to staff with message access.

**Fix:** Security codes are sent through direct delivery without creating normal customer-message records. Provider errors do not log recipients or message contents.

### 8. Supplier access during shop suspension

**Risk:** A supplier portal account could remain usable while its tenant shop was suspended.

**Fix:** Supplier layout and actions require the supplier role, an active user, an active linked supplier and an active shop.

### 9. Generated owner password exposed in URL

**Risk:** New-shop owner credentials were returned through a query parameter, allowing browser history, analytics, referrer and screenshot leakage.

**Fix:** Added secure shop onboarding with an explicit strong owner password. The password is hashed immediately and never appears in a URL, log, audit metadata or response.

### 10. Inconsistent password standards

**Risk:** Different account types accepted different minimum lengths.

**Fix:** Added a shared policy requiring at least 12 characters with at least one letter and one number. Applied it to owner, worker, staff, invitation, supplier, buyer-registration and reset flows. Existing passwords remain valid until changed.

### 11. Production media stored on temporary filesystem

**Risk:** Railway redeploys or restarts could delete uploaded logos and product images when local temporary storage was selected.

**Fix:** Production upload code refuses local storage. Production must use configured S3/R2-compatible durable object storage and a public media URL.

### 12. Unverified shops enabling public sales

**Risk:** A pending tenant could expose a storefront or accept public orders before platform verification.

**Fix:** Public storefront and ordering controls are effective only for active, verified shops. New shops start private.

### 13. Financial recognition errors

**Risk:** Pending or failed online reservations could inflate closing and sales totals.

**Fix:** Closing and reporting recognise eligible order and payment states instead of treating every non-cancelled reservation as realised sales.

### 14. Demo credentials and branding in production source

**Risk:** The public repository documented a known demo password and displayed demo shop branding and links.

**Fix:**

- Removed fixed demo credentials from documentation and the documentation generator.
- CI rejects the retired demo-password value if reintroduced.
- Replaced public demo copy and fake tracking links.
- Added the EJM mark, wordmark, favicon and web-app manifest.
- Mapped the legacy logo path to the EJM mark so missed fallbacks cannot display old artwork.

## Additional Security Controls Confirmed or Added

- Database-backed distributed rate limiting.
- Constant-cost password verification for unknown login identities.
- Staff lockout after repeated failures.
- Session invalidation through `sessionVersion`.
- Buyer-session revocation after account changes.
- Same-origin checks on sensitive JSON and upload endpoints.
- Image type, size, decoding and optimisation validation.
- Paystack webhook HMAC verification using timing-safe comparison.
- Token hashing for invites, resets and one-time codes.
- CSV formula-injection protection.
- HTML escaping in receipt output.
- Content Security Policy, HSTS, frame denial, MIME sniffing protection and restrictive permissions policy.
- Guarded demo seed, activation and permanent purge lifecycle against disposable PostgreSQL in CI.

## CI Validation Gates

The pull request pipeline now runs:

1. Clean dependency installation.
2. High-severity dependency audit.
3. Retired demo-credential scan.
4. Prisma client generation.
5. Full migration deployment against PostgreSQL 16.
6. Demo seed, real-admin activation and guarded demo purge validation.
7. ESLint.
8. TypeScript compilation with uploaded diagnostics on failure.
9. Paystack helper tests.
10. Role-permission tests.
11. Dashboard-access tests.
12. Document-export tests.
13. Session-cookie and password-policy tests.
14. Documentation generation.
15. Production Next.js build.

## Production Configuration Still Required

These are operational gates rather than repository bugs:

- Set a stable, random `SESSION_SECRET` of at least 32 characters.
- Set the canonical HTTPS `APP_URL`.
- Bootstrap and verify the real Super Admin, then remove `ADMIN_PASSWORD` from Railway.
- Run the guarded demo purge once and remove its confirmation variable.
- Configure R2 or S3 media variables before allowing uploads.
- Configure Paystack secret key, shop subaccounts and webhook endpoint before card payments.
- Configure Arkesel credentials and approved sender ID before SMS registration or reminders.
- Set `JOB_SECRET` and schedule the reservation-release endpoint.
- Configure database backups, restore testing and operational alerts.

## Required Manual Smoke Test Before Merge or Deployment

Use a private/incognito browser and a disposable test tenant:

1. Sign in as real Super Admin, refresh several times and open a direct `/admin` URL.
2. Sign in as owner, refresh every dashboard module and open direct links.
3. Sign in as supplier, refresh `/supplier`, suspend the shop and confirm access is rejected.
4. Disable a staff user and confirm the next request invalidates the session.
5. Create two tenants and attempt cross-tenant IDs in catalogue, supplier and network forms.
6. Submit the same supplier receive, network fulfil and checkout request twice.
7. Fail Paystack initialisation and confirm stock, coupon usage and cart state are restored.
8. Run two reservation-release requests concurrently and confirm stock is restored once.
9. Verify OTP and fulfilment messages do not appear in normal message history.
10. Upload a logo and product image through configured durable storage, redeploy and confirm both persist.
11. Confirm favicon, installable-app icon, login logo, admin logo and default shop logo display correctly.
12. Confirm seeded demo identities cannot authenticate and the public marketplace contains no demo shop.

## Residual Engineering Backlog

No static audit can prove the absence of every defect. The remaining engineering work should focus on:

- Automated end-to-end browser coverage for refresh persistence, role boundaries, POS and buyer checkout.
- Paystack refunds, dispute handling and settlement reconciliation.
- Owner and Super Admin 2FA.
- User-visible active-session management and remote logout.
- Scheduled-job observability and alerting.
- Database backup restoration drills.
- Device-specific cutter integration after exact machine protocols are confirmed.

The pull request must remain unmerged until all required CI checks are green and the manual smoke test is completed against a non-production tenant.
