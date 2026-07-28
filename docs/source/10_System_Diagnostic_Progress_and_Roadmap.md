# Eugene Jersey Management - System Diagnostic, Progress, and Roadmap

Updated: 2026-07-28

Live app: https://web-production-8ee56.up.railway.app

GitHub repo: https://github.com/Eugene999B/Eugene-jersey-management

Google Drive documentation pack: https://drive.google.com/drive/folders/1oe55Rtc-MipRfi1_5fdJKxahJ-aYWYEj

## Status summary

The platform is a full-stack Next.js App Router multi-tenant sports shop SaaS. It builds, deploys on Railway, and covers storefronts, POS, debts, a production Design Studio, suppliers, network, admin, Paystack settlement routing, messaging hooks, structural tenant isolation, desktop/mobile browser acceptance, optional personal two-factor authentication, read-only production integration health checks, interruption-safe local design recovery, group-aware editing, immutable design save history, direct layer transform handles, a shared mobile inspector, shop-owned machine profiles, fail-closed vector cut-path export, audited CEO governance controls, a versioned subscription-plan catalogue with second-administrator approval, and isolated SMS/WhatsApp communication-credit wallets with verified administrator-account purchases.

Production account activation is repository-controlled: Railway migrations are followed by `production:activate`, which creates the real administrator from Railway variables and retires seeded demo access.

**Not ready for broad paid shop onboarding** until the Release #17 provider checks are verified against real Railway credentials, controlled payment/message tests are completed and remaining commercial launch controls are finished.

## Already resolved in code

1. **Production account activation** — `railway.toml` runs migrations and the idempotent `production:activate` command. The command creates the real Super Admin from Railway `ADMIN_*` variables, deactivates demo identities, invalidates demo sessions, suspends the demo shop, and disables demo ordering.
2. **Production seed safety** — demo seed is opt-in via `db:seed:demo` / `setup:demo`; published default demo passwords have been removed from active documentation and environment examples.
3. **Suspended tenant login block** — staff and suppliers connected to an inactive shop are rejected during authentication.
4. **Dashboard page-level RBAC** — `src/lib/dashboard-access.ts` is used by `src/proxy.ts`, with a server layout second layer via `x-pathname`.
5. **Structural tenant database isolation** — authenticated shop workspaces use a shop-scoped Prisma client, including protected interactive transactions and permanent two-shop attack verification.
6. **Transaction-safe stock decrement** — POS, cart, and public order use guarded `updateMany` with `stockQty >= quantity`.
7. **Design Studio production workflow** — production sheet workspace, undo/redo, delete, duplicate, save to `DesignJob`, upload via `/api/uploads`, SVG/print/manifest, and device readiness checks.
8. **Design Studio interruption recovery** — meaningful unsaved work is copied to a shop-worker-scoped browser draft, offered explicitly after a reload, and cleared after a successful authoritative shop save.
9. **Versioned design project format** — supported older projects migrate to version 6; group metadata and authoritative machine-profile snapshots survive shop saves, recovery and backups; malformed, oversized, expired and future-version recovery data is rejected safely.
10. **Design Studio multi-select and grouping** — modifier-key selection, group-aware layer selection, whole-selection movement, group/ungroup, duplicate-selected and delete-selected preserve production coordinates and spacing.
11. **Immutable design save history** — every authoritative save creates a `DesignJobVersion`; legacy projects receive a baseline; historical versions open without overwriting the current shop project.
12. **Design Studio transform handles and mobile inspector** — one unlocked layer exposes corner resize and rotation handles with sheet clamping, proportion preservation and Shift-assisted angle snapping; phone and tablet users receive the same exact property controls in a fixed bottom-sheet inspector.
13. **Shop-owned machine profiles** — each shop owns its cutter/RIP profiles, including bed size, output format, plotter units, serial baud, origin and mirror default. Owners/managers manage profiles; designers can select active profiles without changing configuration.
14. **Fail-closed cut-path conversion** — native shapes and supported embedded SVG geometry convert to path-only SVG, HPGL/PLT or DXF; live text, raster images, external artwork, unsupported SVG elements and out-of-sheet paths block cutter export.
15. **Buyer SMS pending password** — password hash is stored on `PhoneVerificationCode.pendingPasswordHash` until verification succeeds.
16. **Paystack callback** — verifies transactions before settlement. Webhooks verify HMAC signatures and record `PaymentProviderEvent`.
17. **Paystack mismatch handling** — amount/currency mismatch updates the Payment row to `FAILED`.
18. **Complete mobile hardening** — shop-owner, public marketplace/storefront, supplier and platform-admin surfaces have 390 × 844 Chromium overflow and navigation coverage.
19. **Optional personal 2FA** — buyers, shop workers, owners, suppliers and platform administrators may individually enable or disable authenticator-based 2FA. It is off by default, uses encrypted secrets and one-time recovery codes, and never allows one administrator to toggle another person's preference.
20. **Production Integration Health control centre** — `/admin/integrations` performs read-only checks for PostgreSQL, the EJM Paystack account, Arkesel, WhatsApp health, S3/R2 storage and the reservation-release scheduler.
21. **Store-owned payment settlement** — every card-enabled store must use its own Paystack subaccount and settlement destination. EJM platform charges remain with the administrator main account.
22. **Administrator-controlled payment routing** — stores may update their settlement details and accepted methods, but only a platform administrator with Billing permission can assign the subaccount, EJM flat charge or Paystack fee bearer.
23. **Scheduled-job monitoring** — reservation-release runs are bearer-token protected and record started, successful and failed heartbeats in the platform audit log.
24. **GitHub validation** — pull requests run dependency audit, Prisma generation and migrations, guarded lifecycle checks, lint, TypeScript, the complete unit suite, tenant-isolation attacks, production build and Chromium journeys.
25. **CEO platform governance** — `/admin/settings` stores audited platform identity, support, legal, marketplace, maintenance, incident, security, retention and upload policies without exposing provider secrets.
26. **Versioned subscription plan catalogue** — the fixed `FREE`, `BASIC`, `PRO` and `ENTERPRISE` tiers have approved prices, trial/grace periods, limits and features; a different billing administrator must approve every commercial change.
27. **Tenant contract snapshots** — existing tenant prices are preserved during migration, catalogue changes never silently reprice shops, and explicit assignment stores an immutable plan-version snapshot.
28. **Included staff enforcement** — active non-owner staff and open invites reserve assigned plan slots; direct creation, invitations and acceptance fail closed through serializable platform transactions when the limit is reached.
29. **Communication package catalogue** — SMS and WhatsApp package prices, paid units, bonuses and availability use written proposals, second-administrator approval and immutable package versions.
30. **Administrator-owned credit checkout** — communication packages use the EJM main Paystack account without a shop subaccount, while ordinary shop sales retain store-owned settlement.
31. **Isolated shop wallets and ledger** — every shop has separate SMS and WhatsApp balances; verified purchases, message usage and provider-failure refunds are recorded through idempotent serializable ledger entries.
32. **Fail-closed message charging** — real provider sends reserve one credit, insufficient balances block dispatch, failed sends refund automatically, and email or console queues remain free.

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
6. Platform subscriptions and SMS/WhatsApp credit purchases belong to the administrator account.
7. Store users cannot change the assigned subaccount, EJM charge or Paystack fee bearer.
8. Only platform administrators with Billing permission can verify and save payment routes.
9. A non-empty subaccount is checked through a read-only provider request before replacing an existing route.
10. Full settlement account numbers must not be displayed or written to audit metadata.
11. One store's funds must never be represented as another tenant's money.

## Subscription catalogue and commercial approval rules

1. The catalogue contains exactly `FREE`, `BASIC`, `PRO` and `ENTERPRISE` tiers.
2. Migration placeholders do not invent prices and cannot be assigned until configured and approved.
3. A billing administrator submits a written proposal containing previous and proposed terms.
4. The requester cannot approve their own proposal; another billing administrator must approve or reject it with a note.
5. Approval fails closed if the plan version changed after the proposal was submitted.
6. Every approved change creates an immutable `SubscriptionPlanVersion`.
7. Existing tenant price/status records are backfilled without modification.
8. Catalogue changes do not reprice existing shops; explicit assignment copies the approved version into `ShopSubscriptionContract`.
9. New shops can only start from a configured active plan and no longer accept arbitrary typed prices.
10. Included staff counts active non-owner accounts and open invites. The owner account is excluded.
11. Product, monthly-order and feature limits are recorded but wider route enforcement remains follow-up work.
12. Catalogue, proposal, version and contract models are platform-commercial data and are denied through normal and interactive tenant clients.

## Communication credit operating rules

1. SMS and WhatsApp packages are channel-specific platform-commercial records.
2. Migration placeholders contain no invented price or credit quantity and existing shops start with zero balances.
3. Package edits require a written proposal, a different Billing administrator, version checking and an immutable approved snapshot.
4. Credit purchases use the EJM administrator Paystack account without a shop subaccount; store customer payments remain unchanged.
5. Callback and webhook settlement verify amount and currency and can credit a purchase only once.
6. Every shop owns separate SMS and WhatsApp wallets and cannot access another tenant's balance, purchase or ledger.
7. One configured-provider message reserves one channel credit atomically before dispatch.
8. Insufficient credit blocks provider dispatch; provider failure refunds the reserved credit through an idempotent ledger entry.
9. Email, console-mode queues and direct platform authentication messages do not consume shop credits.
10. Automatic receipt messaging failure never rolls back a completed shop sale.
11. Package, approval, wallet, purchase and ledger models remain inaccessible through normal and interactive tenant clients.
12. Provider segment pricing, templates, consent, delivery status and cost reconciliation remain controlled rollout work.

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

## Design transform and mobile inspector operating rules

1. Resize and rotation handles appear only when exactly one unlocked visible layer is selected.
2. Image and text proportions remain fixed during canvas resizing; Shift preserves proportions for rectangle and circle layers.
3. Shift-assisted rotation snaps to 15-degree steps.
4. Resize and rotation use the same rotated-boundary sheet clamping as production validation.
5. One pointer transform creates one undo checkpoint rather than one checkpoint per pointer movement.
6. Grouped and multi-selected layers retain shared movement; Release #20 does not silently distort a complete group through one bounding box.
7. The mobile inspector reuses the desktop selection and exact millimetre property controls.
8. Opening the mobile inspector locks background scrolling and it closes through its action, backdrop or Escape key.
9. Transform values are ordinary project layer data and continue through saves, recovery drafts, backups and immutable history without a schema migration.

## Machine profile and cut-path operating rules

1. Every machine profile belongs to one exact shop and all reads/writes include the authenticated `shopId`.
2. Owners and managers may create or manage profiles; designers may select active profiles but cannot change shop machine configuration.
3. Every shop retains at least one active profile and one default profile.
4. Design saves resolve the selected profile server-side and store an authoritative machine-settings snapshot in project version 6.
5. Editing or deleting a profile never rewrites immutable historical snapshots.
6. Native rectangle/circle layers and supported embedded SVG geometry can produce path-only SVG, HPGL/PLT and DXF.
7. Live text, raster images, external artwork, unsupported SVG elements and malformed or out-of-sheet geometry fail closed before cutter output.
8. HPGL uses the selected profile's units per millimetre, origin and mirror setting; DXF uses millimetres and lightweight polylines.
9. Multiple copies must be arranged as separate artwork before cutter export.
10. Machine profile tenant isolation is permanently tested in both normal and interactive transaction clients.

## Still required before selling broadly to shops

1. Verify `/admin/integrations` against real Railway Paystack, Arkesel, WhatsApp, storage and scheduler configuration.
2. Complete a controlled Paystack test transaction for a verified store subaccount and confirm webhook settlement end to end.
3. Paystack: refunds UI, real POS gateway charge, settlement reconciliation and webhook retry dashboard.
4. Arkesel: controlled delivery test, delivery status storage, retry queue, templates, consent/opt-out and provider-cost reconciliation.
5. WhatsApp: approved templates, consent, delivery status, failure handling and a provider-specific read-only health endpoint.
6. Schedule `POST /api/jobs/release-reservations` with `JOBS_API_TOKEN` and confirm recurring successful heartbeats.
7. Add an account session list, device history and per-session forced logout.
8. Design Studio remaining work: multi-layer bounding-box transforms, version comparison/labels, simultaneous-edit protection and broader SVG compatibility based on real production files.
9. Enforce recorded product, monthly-order and feature entitlements across relevant routes; add automated renewal, invoice, dunning and plan self-service workflows.
10. Complete support investigations, public business applications and location-aware marketplace work.
11. Clean the Turbopack media-storage NFT warning.
12. Refresh Google Drive docs after each major merge so they match repository source documentation.

## Recommended implementation order

1. Verify Release #17 production integrations when provider accounts are ready.
2. Add the admin investigation centre and public shop/supplier application pipeline.
3. Enforce remaining subscription entitlements and build renewal/invoice/dunning operations.
4. Add verified coordinates, standard marketplace taxonomy and nearby-shop discovery.
5. Complete Paystack refunds, POS gateway payments and settlement/retry operations.
6. Finish Design Studio collaboration/version-comparison improvements.
7. Complete controlled communication-package payment and provider-delivery tests.
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

1. Read `README.md`, this diagnostic, `docs/source/11_Production_Activation.md`, `docs/source/14_Production_Integration_Health.md`, `docs/source/15_Design_Studio_Reliability.md`, `docs/source/16_Design_Studio_Grouping_and_Version_History.md`, `docs/source/17_Design_Studio_Transform_Handles_and_Mobile_Inspector.md`, `docs/source/18_Design_Studio_Machine_Profiles_and_Cut_Paths.md`, `docs/source/20_CEO_Settings_and_Platform_Governance.md`, and `docs/source/21_Subscription_Plans_and_Commercial_Approval.md`, and `docs/source/22_Communication_Credits_and_Wallets.md` before production changes.
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
12. Design transforms must test exact dimensions, rotation, sheet clamping, undo behavior, grouped movement, save/history/recovery persistence and mobile inspector layout.
13. Machine profiles must remain shop-scoped, server-resolved on save and immutable inside historical version snapshots.
14. Cutter export must fail closed rather than guessing paths for live text, raster artwork or unsupported SVG geometry.
15. Commercial plan changes require a written proposal, another billing administrator, version checking and an immutable approved snapshot.
16. Existing tenant prices must never change merely because a plan catalogue entry changes.
17. Subscription catalogue, proposal, version and tenant-contract models must remain inaccessible through shop tenant clients.
18. Communication package, approval, wallet, purchase and ledger models must remain inaccessible through shop tenant clients and interactive tenant transactions.
19. Communication purchases must settle to the EJM administrator account; normal shop customer payments must retain store-owned subaccount settlement.
20. Use GitHub branches, pull requests, checks and Railway deployment as the production source of truth.
