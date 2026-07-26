# Eugene Jersey Management - System Diagnostic, Progress, and Roadmap

Updated: 2026-07-25 (Grok hardening review)

Live app: https://web-production-8ee56.up.railway.app

GitHub repo: https://github.com/Eugene999B/Eugene-jersey-management

Google Drive documentation pack: https://drive.google.com/drive/folders/1oe55Rtc-MipRfi1_5fdJKxahJ-aYWYEj

## Status summary

The platform is a full-stack Next.js App Router multi-tenant sports shop SaaS. It builds, deploys on Railway, and covers storefronts, POS, debts, design studio, suppliers, network, admin, Paystack hooks, and SMS hooks.

**Not ready for paid shop onboarding** until production credentials are rotated, real payment/SMS providers are verified live, and test coverage grows.

## Already resolved in code (as of 2026-07-22+)

1. **Production seed safety** — `railway.toml` preDeploy runs only `npx prisma migrate deploy`. Demo seed is opt-in via `db:seed:demo` / `setup:demo`. `admin:bootstrap` exists for real Super Admin.
2. **Dashboard page-level RBAC** — `src/lib/dashboard-access.ts` used by `src/proxy.ts`. Patch pack adds a **server layout second layer** via `x-pathname`.
3. **Transaction-safe stock decrement** — POS / cart / public order use guarded `updateMany` with `stockQty >= quantity`.
4. **Design studio** — production sheet workspace, undo/redo, delete, duplicate, save to `DesignJob`, upload via `/api/uploads`, SVG/print/manifest, device readiness checks.
5. **Buyer SMS pending password** — password hash stored on `PhoneVerificationCode.pendingPasswordHash` until `consumePhoneCode` succeeds; not written to `BuyerAccount` early.
6. **Paystack callback** — verifies transaction then settles. Webhook verifies HMAC signature and records `PaymentProviderEvent`.

## Hardening applied in the 2026-07-25 patch pack

1. **Paystack amount/currency mismatch** now updates the Payment row to `FAILED` (previously returned failed without writing FAILED for mismatch).
2. **Proxy** forwards `x-pathname` for server components.
3. **Dashboard layout** re-checks `canAccessDashboardPath` (defense in depth).
4. **New unit tests**: `src/tests/payments.test.ts`, `src/tests/dashboard-access.test.ts`.

## Still required before selling to shops

1. Rotate any live demo accounts (`Ghana123`, seeded Login IDs) on Railway; bootstrap a strong Super Admin.
2. Expand automated tests (E2E login, concurrent stock, design save/load, full Paystack webhook settle with DB).
3. Design: multi-select, group/ungroup, true SVG-to-cut-path HPGL/DXF, per-shop machine profiles, mobile inspector.
4. Paystack: refunds UI, POS real gateway charge (not sandbox record-only), subaccount onboarding UX, webhook retry dashboard.
5. Arkesel: delivery status storage, retry queue, balance warning, templates, consent/opt-out.
6. Schedule `jobs:release-reservations` in production.
7. 2FA for Super Admin and shop Owners; admin session list / force logout.
8. Mobile dashboard UX pass + screenshot tests.
9. Clean Turbopack media-storage NFT warning.
10. Refresh Google Drive docs after each major push so they match `docs/source/10_...`.

## Recommended implementation order

1. Apply the patch pack files and push; run lint / tsc / test / prisma validate / build.
2. Production credential rotation + admin bootstrap.
3. E2E smoke tests for login + role blocking + checkout.
4. Paystack refunds + POS real charge path.
5. Design multi-select / cut-path / mobile.
6. SMS production controls.
7. 2FA and session management.

## Validation commands

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd test
npx.cmd prisma validate
npm.cmd audit --audit-level=moderate
npm.cmd run build
```

## AI handoff rules

1. Read README.md then this diagnostic.
2. Never touch Chalin projects.
3. Keep frontend/backend together in this Next.js app unless deliberately splitting later.
4. Migrations required for schema changes.
5. Access control: check `rbac.ts`, `dashboard-access.ts`, `proxy.ts`, and page server asserts.
6. Design changes: test selection, movement, mirror, zoom, save, mobile layout.
