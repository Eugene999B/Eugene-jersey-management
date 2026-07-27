# Eugene Jersey Management - System Diagnostic, Progress, and Roadmap

Updated: 2026-07-27

Live app: https://web-production-8ee56.up.railway.app

GitHub repo: https://github.com/Eugene999B/Eugene-jersey-management

Google Drive documentation pack: https://drive.google.com/drive/folders/1oe55Rtc-MipRfi1_5fdJKxahJ-aYWYEj

## Status summary

The platform is a full-stack Next.js App Router multi-tenant sports shop SaaS. It builds, deploys on Railway, and covers storefronts, POS, debts, design studio, suppliers, network, admin, Paystack hooks, messaging hooks, structural tenant isolation, desktop/mobile browser acceptance, and optional personal two-factor authentication.

Production account activation is repository-controlled: Railway migrations are followed by `production:activate`, which creates the real administrator from Railway variables and retires seeded demo access.

**Not ready for broad paid shop onboarding** until real payment, SMS, WhatsApp, storage and scheduled-job health are verified live and the remaining commercial controls are completed.

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
13. **GitHub validation** — pull requests run dependency audit, Prisma generation and migrations, guarded lifecycle checks, lint, TypeScript, the complete unit suite, tenant-isolation attacks, production build and Chromium journeys.

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

## Still required before selling broadly to shops

1. Production Integration Health: verify real Paystack connectivity, webhook health, Arkesel delivery checks, WhatsApp readiness, durable storage and scheduled-job monitoring.
2. Paystack: refunds UI, real POS gateway charge, subaccount onboarding UX, settlement reconciliation and webhook retry dashboard.
3. Arkesel: delivery status storage, retry queue, balance warning, templates, consent/opt-out and provider-cost reconciliation.
4. WhatsApp: approved templates, consent, delivery status, failure handling and production provider health.
5. Schedule and monitor `jobs:release-reservations` in production.
6. Add an account session list, device history and per-session forced logout.
7. Design Studio reliability: autosave recovery, versioned canvas data, multi-select, group/ungroup, true SVG-to-cut-path HPGL/DXF, per-shop machine profiles and mobile inspector.
8. Complete CEO-level settings, communication-credit packages, support investigations, public business applications and location-aware marketplace work.
9. Clean the Turbopack media-storage NFT warning.
10. Refresh Google Drive docs after each major merge so they match repository source documentation.

## Recommended implementation order

1. Deploy and verify optional 2FA with an independent Railway encryption key.
2. Complete Production Integration Health for Paystack, Arkesel, WhatsApp, storage and scheduled jobs.
3. Add payment settlement, refund and stock-concurrency integration coverage.
4. Complete Design Studio reliability before adding the remaining machine-production tools.
5. Build CEO settings and SMS/WhatsApp credit packages.
6. Build the admin investigation centre and public shop/supplier application pipeline.
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

1. Read `README.md`, this diagnostic, and `docs/source/11_Production_Activation.md` before production changes.
2. Never touch Chalin projects.
3. Keep frontend/backend together in this Next.js app unless deliberately splitting later.
4. Prisma migrations are required for schema changes.
5. Access control changes must check `rbac.ts`, `dashboard-access.ts`, `proxy.ts`, server assertions, inactive-shop handling, tenant isolation and optional 2FA challenge/session boundaries.
6. Never make 2FA mandatory without a new explicit product decision; the approved rule is personal opt-in/opt-out for every account type.
7. Design changes must test selection, movement, mirror, zoom, save, reload and mobile layout.
8. Use GitHub branches, pull requests, checks and Railway deployment as the production source of truth.
