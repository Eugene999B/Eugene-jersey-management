# Eugene Jersey Management - Project Handoff and Deployment Playbook

A repository-first handoff for developers and coding agents joining the project.

## Executive Summary

Eugene Jersey Management is a full-stack, multi-tenant sports retail and jersey-production platform. It combines tenant administration, staff access, role-based permissions, catalogue and stock, POS, debts, custom production, design tools, customer messaging, supplier purchasing, shop networking, daily closing, exports, public ordering, buyer accounts, audit logging, and deployment automation.

The application is a single Next.js App Router service. UI, route handlers, server actions, authentication, Prisma access, background-job endpoints, and public pages deploy together. Do not treat it as a static frontend with a separate backend unless the architecture is deliberately refactored.

## Current Project Location

- Local path: `C:\Users\DDK\Documents\Jersey\sports-shop-platform-github-ready`
- Framework: Next.js 16 and TypeScript
- Database: PostgreSQL through Prisma 7
- Deployment: Railway application and PostgreSQL service
- Generated docs: `docs/source` and `docs/word`
- Railway config: `railway.toml`
- Prisma schema: `prisma/schema.prisma`

## Security and Production Rules

- Never publish or reuse seeded demo passwords.
- Never run the demo seed against production unless the explicit production safeguards are satisfied.
- Production Super Admin access is created from Railway `ADMIN_*` variables.
- The real administrator must be verified before permanent demo cleanup.
- Staff, supplier, admin, and buyer sessions use HTTP-only signed cookies.
- Authoritative access checks belong in server layouts, actions, and route handlers; Proxy performs only an optimistic cookie-presence redirect.
- Every tenant-owned query or mutation must be scoped to the authenticated `shopId`.
- Suspended shops and inactive users must be rejected by server-side session checks.
- Passwords must meet the shared strong-password policy and must never appear in URLs, logs, documentation, or audit metadata.
- Verification and fulfilment codes must not be stored in customer-message history.
- Production media must use durable S3/R2-compatible storage, not Railway's temporary filesystem.

## Main Implemented Areas

- `/login`: staff, supplier, shop and platform-admin access.
- `/admin`: platform administration, verification, billing, support, workers and security activity.
- `/dashboard`: tenant workspace with POS, orders, production, customers, debts, messages, stock, suppliers, network, closing, commerce, reports and settings.
- `/supplier`: supplier portal with active-shop enforcement.
- `/shops` and `/shop/[slug]`: verified public marketplace and storefronts.
- `/buyer/login`: buyer phone/password and SMS verification flow.
- `/cart`: multi-item buyer checkout.
- `/track/[orderId]`: token-protected order tracking, returns and fulfilment verification.
- `/dashboard/designs`: jersey artwork and production-export tools.

## Important Files

- `src/lib/auth.ts`: staff/admin session validation and password helpers.
- `src/lib/session-token.ts`: staff session JWT signing and verification.
- `src/lib/session-cookie.ts`: durable cookie options.
- `src/lib/buyer-session.ts`: buyer session validation and revocation.
- `src/lib/rbac.ts`: role and permission definitions.
- `src/lib/dashboard-access.ts`: page-level dashboard guards.
- `src/lib/order-lifecycle.ts`: atomic unpaid-reservation cancellation and stock restoration.
- `src/lib/payments.ts`: Paystack initialisation, signature verification and settlement.
- `src/lib/media-storage.ts`: image validation, optimisation and durable storage.
- `src/app/api/pos/checkout/route.ts`: tenant-scoped POS checkout.
- `src/app/cart/actions.ts`: buyer-cart checkout and compensation.
- `src/app/api/public-order/route.ts`: direct public-order checkout.
- `src/app/api/paystack/webhook/route.ts`: idempotent Paystack webhook handling.
- `src/app/admin/create-shop-action.ts`: secure owner and tenant onboarding without URL credentials.
- `prisma/seed.ts`: guarded local demo data only.
- `scripts/activate-production.ts`: idempotent real-admin activation and demo retirement.
- `scripts/purge-demo-data.ts`: guarded one-time demo removal.

## Local Commands

```powershell
cd C:\Users\DDK\Documents\Jersey\sports-shop-platform-github-ready
npm.cmd install
copy .env.example .env
npm.cmd run db:generate
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd test
npm.cmd run build
npm.cmd run docs:generate
```

Use `npm.cmd run setup:demo` only for an intentional local demo environment after setting a unique `SEED_DEMO_PASSWORD` of at least 12 characters. No fixed demo password is stored in this repository.

## Production Activation

Railway uses the repository's `railway.toml`:

- Build: Prisma generate and Next.js build.
- Pre-deploy: Prisma migrations, production admin activation, and guarded demo cleanup.
- Start: standalone Next.js server bound to `0.0.0.0`.
- Health check: `/api/health`.

Required production variables include `DATABASE_URL`, `SESSION_SECRET`, `APP_URL`, `ADMIN_EMAIL`, and the initial `ADMIN_PASSWORD`. Configure Paystack, messaging, durable media storage, and the reservation-job secret before enabling their corresponding production features.

After the real administrator works:

1. Remove `ADMIN_PASSWORD` from Railway variables.
2. Keep `ADMIN_FORCE_RESET=false` during normal operation.
3. Use the guarded purge confirmation only once, verify the result, then remove it.
4. Confirm seeded users, buyer, supplier and shop are inactive or removed.
5. Confirm the public marketplace contains only verified real shops.

## Deployment Architecture

The recommended deployment is the full Next.js application and PostgreSQL on Railway. Cloudflare can sit in front for DNS, TLS, WAF, caching and custom-domain proxying. A static Cloudflare Pages frontend would require a deliberate backend extraction and API migration first.

## Change Checklist

Before finishing a change:

1. Inspect the current branch and pull-request diff.
2. Preserve unrelated user work.
3. Keep all tenant data scoped to `session.shopId` or another verified tenant identifier.
4. Preserve server-side role checks even when the UI hides a control.
5. Add a Prisma migration for schema changes.
6. Run migrations against disposable PostgreSQL in CI.
7. Run lint, TypeScript, tests and production build.
8. Review payment, stock and coupon state transitions for retries and races.
9. Confirm no password, verification code, access token or provider secret is logged.
10. Keep the pull request draft until every required check is green.

## Current Priorities After This Audit

- End-to-end browser tests for login refresh persistence, POS, buyer checkout and role boundaries.
- Production Paystack refund and reconciliation workflows.
- Arkesel sender approval and delivery-status controls.
- Owner/admin 2FA and active-session management.
- Reservation-job scheduling and operational alerting.
- Design Studio device-specific integrations after cutter models and protocols are confirmed.
