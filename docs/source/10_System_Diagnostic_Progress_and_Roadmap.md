# Eugene Jersey Management - System Diagnostic, Progress, and Roadmap

Updated: 2026-07-27

Live app: https://web-production-8ee56.up.railway.app

GitHub repo: https://github.com/Eugene999B/Eugene-jersey-management

Google Drive documentation pack: https://drive.google.com/drive/folders/1oe55Rtc-MipRfi1_5fdJKxahJ-aYWYEj

## Status summary

The platform is a full-stack Next.js App Router multi-tenant sports shop SaaS. It builds, deploys on Railway, and covers storefronts, POS, debts, a production Design Studio, suppliers, network, admin, Paystack settlement routing, messaging hooks, structural tenant isolation, desktop/mobile browser acceptance, optional personal two-factor authentication, read-only production integration health checks, interruption-safe local design recovery, group-aware editing and immutable design save history.

Production account activation is repository-controlled: Railway migrations are followed by `production:activate`, which creates the real administrator from Railway variables and retires seeded demo access.

**Not ready for broad paid shop onboarding** until the Release #17 provider checks are verified against real Railway credentials, controlled payment/message tests are completed, and the remaining commercial controls are finished.

## Already resolved in code

1. **Production account activation** — `railway.toml` runs migrations and the idempotent `production:activate` command. The command creates the real Super Admin from Railway `ADMIN_*` variables, deactivates demo identities, invalidates demo sessions, suspends the demo shop, and disables demo ordering.
2. **Production seed safety** — demo seed is opt-in via `db:seed:demo` / `setup:demo`; published default demo passwords have been removed from active documentation and environment examples.
3. **Suspended tenant login block** — staff and suppliers connected to an inactive shop are rejected during authentication.
4. **Dashboard page-level RBAC** — `src/lib/dashboard-access.ts` is used by `src/proxy.ts`, with a server layout second layer via `x-pathname`.
5. **Structural tenant database isolation** — authenticated shop workspaces use a shop-scoped Prisma client, including protected interactive transactions and permanent two-shop attack verification.
6. **Transaction-safe stock decrement** — POS, cart, and public order use guarded `updateMany` with `stockQty >= quantity`.
7. **Design Studio production workflow** — production sheet workspace, undo/redo, delete, duplicate, save to `DesignJob`, upload via `/api/uploads`, SVG/print/manifest, and device readiness checks.
8. **Design Studio interruption recovery** — meaningful unsaved work is copied to a shop-worker-scoped browser draft, offered explicitly after a reload, and cleared after a successful authoritative shop save.
9. **Versioned design project format** — supported older projects migrate to version 5; group metadata survives shop saves, recovery and backups; malformed, oversized, expired and future-version recovery data is rejected safely.
10. **Design Studio multi-select and grouping** — modifier-key selection, group-aware layer selection, whole-selection movement, group/ungroup, duplicate-selected and delete-selected preserve production coordinates and spacing.
11. **Immutable design save history** — every authoritative save creates a `DesignJobVersion`; legacy projects receive a baseline; historical versions open without overwriting the current shop project.
12. **Buyer SMS pending password** — password hash is stored on `PhoneVerificationCode.pendingPasswordHash` until verification succeeds.
13. **Paystack callback** — verifies transactions before settlement. Webhooks verify HMAC signatures and record `PaymentProviderEvent`.
14. **Paystack mismatch handling** — amount/currency mismatch updates the Payment row to `FAILED`.
15. **Complete mobile hardening** — shop-owner, public marketplace/storefront, supplier and platform-admin surfaces have 390 × 844 Chromium overflow and navigation coverage.
16. **Optional personal 2FA** — buyers, shop workers, owners, suppliers and platform administrators may individually enable or disable authenticator-based 2FA. It is off by default, uses encrypted secrets and one-time recovery codes, and never allows one administrator to toggle another person's preference.
17. **Production Integration Health control centre** — `/admin/integrations` performs read-only checks for PostgreSQL, the EJM Paystack account, Arkesel, WhatsApp health, S3/R2 storage and the reservation-release scheduler.
18. **Store-owned payment settlement** — every card-enabled store must use its own Paystack subaccount and settlement destination. EJM platform charges remain with the administrator main account.
19. **Administrator-controlled payment routing** — stores may update their settlement details and accepted methods, but only a platform administrator with Billing permission can assign the subaccount, EJM flat charge or Paystack fee bearer.
20. **Scheduled-job monitoring** — reservation-release runs are bearer-token protected and record started, successful and failed heartbeats in the platform audit log.
21. **GitHub validation** — pull requests run dependency audit, Prisma generation and migrations, guarded lifecycle checks, lint, TypeScript, the complete unit suite, tenant-isolation attacks, production build and Chromium journeys.

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

## Design recovery operating rules

1. The database `DesignJob` remains the authoritative shared current shop project.
2. Browser recovery is a temporary safety net on one browser profile and device.
3. Recovery is scoped to the exact shop and worker account.
4. A newer draft is never opened silently; the operator must restore or discard it.
5. A stale draft is removed when the database copy is newer.
6. A successful shop save clears the browser recovery draft.
7. Recovery data older than 14 days or larger than 1,800,000 bytes is rejected.
8. Projects from a future unsupported studio version are rejected rather than partially loaded.
9. Recovery storage never contains passwords, sessions, payment credentials or provider keys.
10. Operators should still download a `.design.json` backup before major production changes.

## Design grouping and history operating rules

1. Clicking a grouped member selects the complete group; modifier keys add or remove layer units from the current selection.
2. Dragging or nudging a selection moves every unlocked selected layer together and clamps the complete selection to the sheet.
3. Locked selected layers remain fixed until explicitly unlocked.
4. `groupId` is project data and must survive saves, backups, recovery drafts and historical snapshots.
5. Every successful authoritative save creates a new immutable `DesignJobVersion`.
6. Existing projects without history receive an imported baseline before the first changed save.
7. Opening an older version only loads a working copy; it does not overwrite `DesignJob` until the operator explicitly saves.
8. Saving an opened historical version creates another new version and never modifies the original snapshot.
9. Version records must always be filtered by both authenticated shop and design project.
10. The generic tenant client and tenant interactive transactions must continue to deny direct `DesignJobVersion` access; only the dedicated reviewed API may read it.

## Still required before selling broadly to shops

1. Verify `/admin/integrations` against real Railway Paystack, Arkesel, WhatsApp, storage and scheduler configuration.
2. Complete a controlled Paystack test transaction for a verified store subaccount and confirm webhook settlement end to end.
3. Paystack: refunds UI, real POS gateway charge, settlement reconciliation and webhook retry dashboard.
4. Arkesel: controlled delivery test, delivery status storage, retry queue, templates, consent/opt-out and provider-cost reconciliation.
5. WhatsApp: approved templates, consent, delivery status, failure handling and a provider-specific read-only health endpoint.
6. Schedule `POST /api/jobs/release-reservations` with `JOBS_API_TOKEN` and confirm recurring successful heartbeats.
7. Add an account session list, device history and per-session forced logout.
8. Design Studio remaining work: richer transform handles, a dedicated mobile inspector, true SVG-to-cut-path HPGL/DXF, per-shop machine profiles, version comparison/labels and simultaneous-edit protection.
9. Complete CEO-level settings, communication-credit packages, support investigations, public business applications and location-aware marketplace work.
10. Clean the Turbopack media-storage NFT warning.
11. Refresh Google Drive docs after each major merge so they match repository source documentation.

## Recommended implementation order

1. Verify Release #17 production integrations when provider accounts are ready.
2. Continue Design Studio production tooling with transform handles and mobile inspection.
3. Add per-shop machine profiles and true production cut-path conversion/export.
4. Complete controlled Paystack subaccount settlement and webhook reconciliation testing.
5. Add Paystack refunds, POS gateway payments and settlement/retry operations.
6. Build SMS and WhatsApp credit packages using the EJM administrator payment account.
7. Build CEO settings, the admin investigation centre and public shop/supplier application pipeline.
8. Add verified coordinates, standard marketplace taxonomy and nearby-shop discovery.
9. Complete commercial launch hardening and a controlled real-shop pilot.

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

1. Read `README.md`, this diagnostic, `docs/source/11_Production_Activation.md`, `docs/source/14_Production_Integration_Health.md`, `docs/source/15_Design_Studio_Reliability.md`, and `docs/source/16_Design_Studio_Grouping_and_Version_History.md` before production changes.
2. Never touch Chalin projects.
3. Keep frontend/backend together in this Next.js app unless deliberately splitting later.
4. Prisma migrations are required for schema changes.
5. Access control changes must check `rbac.ts`, `dashboard-access.ts`, `proxy.ts`, server assertions, inactive-shop handling, tenant isolation and optional 2FA challenge/session boundaries.
6. Never make 2FA mandatory without a new explicit product decision; the approved rule is personal opt-in/opt-out for every account type.
7. Never replace store-owned settlement with a shared tenant balance. Customer store payments must retain their store subaccount assignment.
8. Never let a store user change the EJM platform fee or Paystack fee bearer.
9. Provider health checks must remain read-only and must not create transactions, send messages, upload files or release stock.
10. Browser design recovery must remain scoped to the current shop and worker and must never silently overwrite the database copy.
11. Design version history must remain immutable, shop-filtered and inaccessible through the generic tenant client.
12. Design changes must test selection, grouped movement, mirror, save, history reopen, reload, recovery and mobile layout.
13. Use GitHub branches, pull requests, checks and Railway deployment as the production source of truth.
