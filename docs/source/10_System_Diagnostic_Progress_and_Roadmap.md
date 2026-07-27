# Eugene Jersey Management - System Diagnostic, Progress, and Roadmap

Updated: 2026-07-27

Live app: https://web-production-8ee56.up.railway.app

GitHub repo: https://github.com/Eugene999B/Eugene-jersey-management

Google Drive documentation pack: https://drive.google.com/drive/folders/1oe55Rtc-MipRfi1_5fdJKxahJ-aYWYEj

## Status summary

The platform is a full-stack Next.js App Router multi-tenant sports shop SaaS. It builds, deploys on Railway, and covers storefronts, POS, debts, design studio, suppliers, network, admin, Paystack settlement routing, messaging hooks, structural tenant isolation, desktop/mobile browser acceptance, optional personal two-factor authentication, and read-only production integration health checks.

Production account activation is repository-controlled: Railway migrations are followed by `production:activate`, which creates the real administrator from Railway variables and retires seeded demo access.

**Not ready for broad paid shop onboarding** until the Release #17 provider checks are verified against real Railway credentials, controlled payment/message tests are completed, and the remaining commercial controls are finished.

## Already resolved in code

1. **Production account activation** — `railway.toml` runs migrations and the idempotent `production:activate` command. The command creates the real Super Admin from Railway `ADMIN_*` variables, deactivates demo identities, invalidates demo sessions, suspends the demo shop, and disables demo ordering.
2. **Production seed safety** — demo seed is opt-in via `db:seed:demo` / `setup:demo`; published default demo passwords have been removed from active documentation and environment examples.
3. **Suspended tenant login block** — staff and suppliers connected to an inactive shop are rejected during authentication.
4. **Dashboard page-level RBAC** — `src/lib/dashboard-access.ts` is used by `src/proxy.ts`, with a server layout second layer via `x-pathname`.
5. **Structural tenant database isolation** — authenticated shop workspaces use a shop-scoped Prisma client, including protected interactive transactions and permanent two-shop attack verification.
6. **Transaction-safe stock decrement** — POS, cart, and public order use guarded `updateMany` with `stockQty >= quantity`.
7. **Design studio** — production sheet workspace, undo/redo, delete, duplicate, save to `DesignJob`, upload via `/api/uploads`, SVG/print/manifest, and device readiness checks.
8. **Buyer SMS pending password** — password hash is stored on `PhoneVerificationCode.pendingPasswordHash` until verification succeeds.
9. **Paystack callback** — verifies transactions before settlement. Webhooks verify HMAC signatures and record `PaymentProviderEvent`.
10. **Paystack mismatch handling** — amount/currency mismatch updates the Payment row to `FAILED`.
11. **Complete mobile hardening** — shop-owner, public marketplace/storefront, supplier and platform-admin surfaces have 390 × 844 Chromium overflow and navigation coverage.
12. **Optional personal 2FA** — buyers, shop workers, owners, suppliers and platform administrators may individually enable or disable authenticator-based 2FA. It is off by default, uses encrypted secrets and one-time recovery codes, and never allows one administrator to toggle another person's preference.
13. **Production Integration Health control centre** — `/admin/integrations` performs read-only checks for PostgreSQL, the EJM Paystack account, Arkesel, WhatsApp health, S3/R2 storage and the reservation-release scheduler.
14. **Store-owned payment settlement** — every card-enabled store must use its own Paystack subaccount and settlement destination. EJM platform charges remain with the administrator main account.
15. **Administrator-controlled payment routing** — stores may update their settlement details and accepted methods, but only a platform administrator with Billing permission can assign the subaccount, EJM flat charge or Paystack fee bearer.
16. **Scheduled-job monitoring** — reservation-release runs are bearer-token protected and record started, successful and failed heartbeats in the platform audit log.
17. **GitHub validation** — pull requests run dependency audit, Prisma generation and migrations, guarded lifecycle checks, lint, TypeScript, the complete unit suite, tenant-isolation attacks, production build and Chromium journeys.

## Optional two-factor operating rules

1. Two-factor authentication is optional for every account type and disabled by default.
2. Each account holder manages only their own preference from personal security settings.
3. Enabling requires the current password plus an authenticator confirmation code.
4. Disabling requires the current password plus an authenticator or unused recovery code.
5. Enabling or disabling revokes every previous session for that account.
6. Protected accounts fail closed when the independent `TWO_FACTOR_ENCRYPTION_KEY` is unavailable or their stored secret is damaged.
7. Recovery codes are displayed only when created, stored only as keyed hashes, and consumed once.
8. `AccountTwoFactor` is platform-global and is blocked from every shop-scoped client, including interactive transactions.
9. Production must configure a strong independent `TWO_FACTOR_ENCRYPTION_KEY`; it must not reuse `SESSION_SECRET`.

## Payment ownership and settlement rules

1. The EJM administrator owns the main Paystack integration configured by `PAYSTACK_SECRET_KEY`.
2. Each store owns its own Paystack subaccount and settlement bank account.
3. Customer payments for a store are initialized with that store's subaccount code.
4. The store receives its settlement through its own Paystack subaccount.
5. A configured flat EJM `transaction_charge` remains with the administrator main account.
6. Platform subscriptions and future SMS/WhatsApp credit purchases belong to the administrator account.
7. Store users cannot change the assigned subaccount, EJM charge or Paystack fee bearer.
8. Only platform administrators with Billing permission can verify and save payment routes.
9. A non-empty subaccount is checked through a read-only provider request before replacing an existing route.
10. Full settlement account numbers must not be displayed or written to audit metadata.
11. One store's funds must never be represented as another tenant's money.

## Still required before selling broadly to shops

1. Deploy Release #17 and verify `/admin/integrations` against real Railway Paystack, Arkesel, WhatsApp, storage and scheduler configuration.
2. Complete a controlled Paystack test transaction for a verified store subaccount and confirm webhook settlement end to end.
3. Paystack: refunds UI, real POS gateway charge, settlement reconciliation and webhook retry dashboard.
4. Arkesel: controlled delivery test, delivery status storage, retry queue, templates, consent/opt-out and provider-cost reconciliation.
5. WhatsApp: approved templates, consent, delivery status, failure handling and a provider-specific read-only health endpoint.
6. Schedule `POST /api/jobs/release-reservations` with `JOBS_API_TOKEN` and confirm recurring successful heartbeats.
7. Add an account session list, device history and per-session forced logout.
8. Design Studio reliability: autosave recovery, versioned canvas data, multi-select, group/ungroup, true SVG-to-cut-path HPGL/DXF, per-shop machine profiles and mobile inspector.
9. Complete CEO-level settings, communication-credit packages, support investigations, public business applications and location-aware marketplace work.
10. Clean the Turbopack media-storage NFT warning.
11. Refresh Google Drive docs after each major merge so they match repository source documentation.

## Recommended implementation order

1. Deploy and verify Release #17 production integration health.
2. Complete controlled Paystack subaccount settlement and webhook reconciliation testing.
3. Add Paystack refunds, POS gateway payments and settlement/retry operations.
4. Build SMS and WhatsApp credit packages using the EJM administrator payment account.
5. Complete Design Studio reliability before adding the remaining machine-production tools.
6. Build CEO settings, the admin investigation centre and public shop/supplier application pipeline.
7. Add verified coordinates, standard marketplace taxonomy and nearby-shop discovery.
8. Complete commercial launch hardening and a controlled real-shop pilot.

## Validation commands

GitHub Actions is the primary validation source. Equivalent commands are:

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd test
npx.cmd prisma validate
npm.cmd audit --audit-level=moderate
npm.cmd run build
```

## AI handoff rules

1. Read `README.md`, this diagnostic, `docs/source/11_Production_Activation.md`, and `docs/source/14_Production_Integration_Health.md` before production changes.
2. Never touch Chalin projects.
3. Keep frontend/backend together in this Next.js app unless deliberately splitting later.
4. Prisma migrations are required for schema changes.
5. Access control changes must check `rbac.ts`, `dashboard-access.ts`, `proxy.ts`, server assertions, inactive-shop handling, tenant isolation and optional 2FA challenge/session boundaries.
6. Never make 2FA mandatory without a new explicit product decision; the approved rule is personal opt-in/opt-out for every account type.
7. Never replace store-owned settlement with a shared tenant balance. Customer store payments must retain their store subaccount assignment.
8. Never let a store user change the EJM platform fee or Paystack fee bearer.
9. Provider health checks must remain read-only and must not create transactions, send messages, upload files or release stock.
10. Design changes must test selection, movement, mirror, zoom, save, reload and mobile layout.
11. Use GitHub branches, pull requests, checks and Railway deployment as the production source of truth.
