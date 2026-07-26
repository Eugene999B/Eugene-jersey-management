# Eugene Jersey Management - System Diagnostic, Progress, and Roadmap

Updated: 2026-07-26

Live app: https://web-production-8ee56.up.railway.app

GitHub repo: https://github.com/Eugene999B/Eugene-jersey-management

Google Drive documentation pack: https://drive.google.com/drive/folders/1oe55Rtc-MipRfi1_5fdJKxahJ-aYWYEj

## Status summary

The platform is a full-stack Next.js App Router multi-tenant sports shop SaaS. It builds, deploys on Railway, and covers storefronts, POS, debts, design studio, suppliers, network, admin, Paystack hooks, and SMS hooks.

Production account activation is now repository-controlled: Railway migrations are followed by `production:activate`, which creates the real administrator from Railway variables and retires seeded demo access.

**Not ready for paid shop onboarding** until the activation deployment succeeds, the real administrator login is verified, real payment/SMS providers are verified live, and test coverage grows.

## Already resolved in code

1. **Production account activation** — `railway.toml` runs migrations and the idempotent `production:activate` command. The command creates the real Super Admin from Railway `ADMIN_*` variables, deactivates demo identities, invalidates demo sessions, suspends the demo shop, and disables demo ordering.
2. **Production seed safety** — demo seed is opt-in via `db:seed:demo` / `setup:demo`; published default demo passwords have been removed from active documentation and environment examples.
3. **Suspended tenant login block** — staff and suppliers connected to an inactive shop are rejected during authentication.
4. **Dashboard page-level RBAC** — `src/lib/dashboard-access.ts` is used by `src/proxy.ts`, with a server layout second layer via `x-pathname`.
5. **Transaction-safe stock decrement** — POS, cart, and public order use guarded `updateMany` with `stockQty >= quantity`.
6. **Design studio** — production sheet workspace, undo/redo, delete, duplicate, save to `DesignJob`, upload via `/api/uploads`, SVG/print/manifest, and device readiness checks.
7. **Buyer SMS pending password** — password hash is stored on `PhoneVerificationCode.pendingPasswordHash` until verification succeeds.
8. **Paystack callback** — verifies transactions before settlement. Webhooks verify HMAC signatures and record `PaymentProviderEvent`.
9. **Paystack mismatch handling** — amount/currency mismatch updates the Payment row to `FAILED`.
10. **GitHub validation** — pull requests run PostgreSQL migrations, lint, TypeScript, unit tests, and production build.

## Immediate activation checklist

1. Merge the production activation pull request after GitHub validation passes.
2. Confirm Railway deploy succeeds with all required `ADMIN_*` variables.
3. Sign in using the real `ADMIN_LOGIN_ID` or `ADMIN_EMAIL` and confirm `/admin` opens.
4. Confirm seeded demo staff, supplier, buyer, and shop access no longer works.
5. Set `ADMIN_FORCE_RESET=false` after activation. Remove `ADMIN_PASSWORD` after the real login is verified.

## Still required before selling to shops

1. Expand automated tests: E2E login, concurrent stock, design save/load, and full Paystack webhook settlement with a database.
2. Design: multi-select, group/ungroup, true SVG-to-cut-path HPGL/DXF, per-shop machine profiles, and mobile inspector.
3. Paystack: refunds UI, real POS gateway charge, subaccount onboarding UX, and webhook retry dashboard.
4. Arkesel: delivery status storage, retry queue, balance warning, templates, and consent/opt-out.
5. Schedule `jobs:release-reservations` in production.
6. Add 2FA for Super Admin and shop Owners, plus admin session list and forced logout.
7. Complete the mobile dashboard UX pass and screenshot tests.
8. Clean the Turbopack media-storage NFT warning.
9. Refresh Google Drive docs after each major merge so they match repository source documentation.

## Recommended implementation order

1. Complete and deploy production account activation.
2. Run E2E smoke tests for real admin login, role blocking, and checkout.
3. Add stock concurrency and payment settlement integration tests.
4. Complete Paystack refunds and real POS charge path.
5. Complete Design Studio multi-select, cut-path, and mobile work.
6. Add SMS production controls.
7. Add 2FA and session management.

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
5. Access control changes must check `rbac.ts`, `dashboard-access.ts`, `proxy.ts`, server assertions, and inactive-shop handling.
6. Design changes must test selection, movement, mirror, zoom, save, and mobile layout.
7. Use GitHub branches, pull requests, checks, and Railway deployment as the production source of truth.
