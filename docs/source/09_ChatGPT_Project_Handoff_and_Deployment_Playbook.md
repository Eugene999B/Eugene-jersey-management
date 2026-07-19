# Sports Shop Platform - ChatGPT Project Handoff and Deployment Playbook

A wide context document for ChatGPT, another AI coding agent, or a developer joining the project.

## Executive Summary

Sports Shop Platform is a full-stack multi-tenant sports retail SaaS application. It was built from the YPMS roadmap document as a Phase 1 MVP covering tenant administration, staff login, RBAC, catalog, POS, custom production orders, customers, reports, branding, audit logs, and generated documentation.

The project is not a separated frontend/backend architecture yet. It is a Next.js App Router application where the user interface, backend API routes, server actions, authentication, database access, and public tracking pages live in the same app. This matters for deployment decisions.

## Current Project Location

- Local path: C:\Users\DDK\Documents\Jersey\sports-shop-platform
- Primary app framework: Next.js 16 App Router with TypeScript.
- Database: PostgreSQL through Prisma ORM v7 and @prisma/adapter-pg.
- Styling: Tailwind CSS v4 with custom global UI classes.
- Generated docs: docs/word and docs/source.
- Railway config: railway.toml.
- Prisma schema: prisma/schema.prisma.
- Initial production migration: prisma/migrations/20260714163000_init/migration.sql.

## What Is Implemented

- Landing page and login flow.
- HTTP-only JWT session cookie signed with jose.
- bcrypt password hashes and account lockout after failed attempts.
- Super Admin panel at /admin for shops, suspension/reactivation, tenant detail, usage, and announcements.
- Tenant dashboard at /dashboard with KPIs, low stock, recent orders, and branded shell.
- Catalog module with categories, templates, products, variants, stock quantities, low-stock thresholds, and personalization/service/rental flags.
- POS module with touch-friendly product grid, cart, discounts, personalization modal, payment method choice, stock decrement, order creation, and payment record.
- Orders module with production board and role-limited status changes.
- Public tracking page at /track/[orderId] or /track/[receiptNumber].
- Customers, reports, staff invites, shop settings, receipt HTML, notifications table, and audit logs.
- Seed data for Accra Pro Sports and demo users.

## Important Files

- src/lib/db.ts: shared Prisma client using PrismaPg adapter.
- src/lib/auth.ts and src/lib/session-token.ts: password helpers, sessions, cookies, and auth guards.
- src/lib/rbac.ts: role labels, permission groups, and navigation visibility.
- src/proxy.ts: route protection for /dashboard and /admin.
- src/app/api/pos/checkout/route.ts: server-side POS checkout and stock decrement.
- src/app/api/orders/[orderId]/status/route.ts: production status updates and role enforcement.
- src/app/dashboard/*: tenant-facing modules.
- src/app/admin/*: platform Super Admin modules.
- prisma/seed.ts: demo data seed script.
- scripts/generate-docs.ts: generates the Word and markdown documentation pack.

## Local Commands

```powershell
npm.cmd install
npm.cmd run setup:demo
npm.cmd run dev
npm.cmd run lint
npm.cmd run test
npm.cmd run build
npm.cmd run docs:generate
```

## Demo Accounts

- Password for all seeded accounts: ChangeMe123!
- super@ypms.test: Super Admin, opens /admin.
- owner@accra.test: Owner, full shop workspace.
- manager@accra.test: Manager.
- cashier@accra.test: POS and order operations.
- designer@accra.test: production order workflow.
- accountant@accra.test: reports and financial visibility.

## Deployment Answer: Railway Backend and Database, Cloudflare Frontend

The exact split of backend plus database on Railway and frontend on Cloudflare Pages is not the best fit for this codebase as it exists today. The backend is not a separate Express, Nest, or FastAPI service; it is integrated into Next.js through route handlers and server actions. If only static frontend files are sent to Cloudflare Pages, login, dashboard data, POS checkout, reports, order updates, and receipts will break unless the backend is refactored into a separate API service and the frontend is changed to call that API.

The recommended first production deployment is to deploy the full Next.js app and PostgreSQL database on Railway. Then optionally put Cloudflare in front as DNS, CDN, WAF, and custom domain proxy. This gives you Cloudflare benefits without prematurely splitting the app.

A future split is possible. To do it properly, create a separate backend service on Railway, move Prisma/auth/API logic into that service, expose versioned REST or GraphQL endpoints, and convert the Next.js frontend to a mostly client/static Cloudflare app that consumes the Railway API.

## Recommended Production Path

- Step 1: Push sports-shop-platform to a private GitHub repository.
- Step 2: Create a Railway project from that GitHub repository.
- Step 3: Add a Railway PostgreSQL database.
- Step 4: Add DATABASE_URL to the Next.js service as a reference variable from the Postgres service.
- Step 5: Set SESSION_SECRET, APP_URL, PAYSTACK keys, and notification provider variables.
- Step 6: Let railway.toml run build, pre-deploy migrations, start command, and healthcheck.
- Step 7: Generate a Railway public domain or connect a custom domain.
- Step 8: Use Cloudflare DNS/proxy for the custom domain if desired.

## GitHub Push Instructions

Create a new empty GitHub repository. Do not initialize it with README, license, or gitignore because the project already has those files. Then run the following from the sports-shop-platform folder.

```powershell
cd C:\Users\DDK\Documents\Jersey\sports-shop-platform
git init
git add .
git commit -m "Initial Sports Shop Platform build"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/sports-shop-platform.git
git push -u origin main
```

## Railway Deployment Instructions

- In Railway, create a new project and choose Deploy from GitHub repo.
- Select the sports-shop-platform repository.
- Add a PostgreSQL database service from Railway.
- In the Next.js service Variables tab, add DATABASE_URL as a reference to the Postgres service.
- Add SESSION_SECRET with a long random value. Never use the local dev value in production.
- Add APP_URL with the Railway or custom domain URL.
- Confirm railway.toml is detected. It sets buildCommand, preDeployCommand, startCommand, healthcheckPath, and restart policy.
- After first deploy, open /login and sign in with a real production Super Admin. Do not rely on demo seed users for production.

## Cloudflare Options

- Best near-term option: use Cloudflare DNS, proxy, SSL, caching rules, and WAF in front of the Railway app.
- Full Cloudflare app option: deploy the entire Next.js app to Cloudflare Workers using the OpenNext adapter. This requires Cloudflare-specific configuration and careful testing of Prisma/PostgreSQL connectivity through edge-compatible drivers or Hyperdrive.
- Static frontend option: only possible after refactoring the backend into a separate Railway API and changing the frontend to call that API.

## Current Official References Used

- Railway Next.js with Postgres guide: https://docs.railway.com/guides/nextjs
- Railway config as code reference: https://docs.railway.com/config-as-code/reference
- GitHub local repository push guide: https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github
- Cloudflare Workers Next.js guide: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- Cloudflare Pages Next.js guide: https://developers.cloudflare.com/pages/framework-guides/nextjs/
- Prisma Cloudflare deployment guide: https://www.prisma.io/docs/orm/prisma-client/deployment/edge/deploy-to-cloudflare
- Cloudflare Hyperdrive Prisma ORM example: https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/prisma-orm/

## What To Ask ChatGPT Next

Paste the prompt below into ChatGPT together with this document or the repository link. It tells ChatGPT how to understand the project without guessing.

```text
You are helping me continue a project named Sports Shop Platform.
It is a full-stack Next.js 16 App Router + TypeScript + Prisma v7 + PostgreSQL multi-tenant sports retail SaaS.
Read the repository first. Important files: prisma/schema.prisma, src/lib/db.ts, src/lib/auth.ts, src/lib/rbac.ts, src/proxy.ts, src/app/dashboard, src/app/admin, src/app/api, scripts/generate-docs.ts, railway.toml.
Do not assume frontend and backend are separate. Server actions, route handlers, auth, and Prisma live inside the Next.js app.
When changing database models, update prisma/schema.prisma and create a proper Prisma migration.
Keep tenant isolation by always scoping tenant data with session.shopId.
Keep role permissions consistent with src/lib/rbac.ts.
Before finishing any change, run npm run lint, npm run test, npm run build, and npm audit --audit-level=moderate.
My deployment target is Railway for the full-stack app and PostgreSQL first, with Cloudflare as DNS/proxy. Only split frontend to Cloudflare later if we refactor the backend into a separate API.
```

## Near-Term Development Backlog

- Create production Super Admin setup command and remove dependency on demo seed users.
- Add real Paystack webhook confirmation and refund handling.
- Add SMS/WhatsApp provider implementation for Twilio or Africa's Talking.
- Add CSV import mapping UI for catalog bulk uploads.
- Add customer account storefront or public shop pages.
- Add rate limiting on login, reset password, checkout, and tracking endpoints.
- Add 2FA for owner and admin roles.
- Add automated end-to-end tests for login, POS checkout, and order workflow.
