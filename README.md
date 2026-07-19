# Sports Shop Platform

Multi-tenant sports retail platform built from the uploaded YPMS roadmap. It includes a Super Admin console, shop dashboard, catalog, POS checkout, production order board, customer records, reports, staff invites, branding settings, public tracking, Prisma/PostgreSQL schema, seed data, and a generated Word documentation pack.

## Quick Start

```powershell
cd C:\Users\DDK\Documents\Jersey\sports-shop-platform
npm.cmd install
copy .env.example .env
docker compose up -d
npm.cmd run setup:demo
npm.cmd run dev
```

No Docker installed? Use Prisma's local Postgres helper:

```powershell
npx.cmd prisma dev --name sports-shop-platform --detach
npx.cmd prisma dev ls
# Copy the TCP DATABASE_URL into .env, then run:
npm.cmd run setup:demo
npm.cmd run dev
```

Open `http://localhost:3000`.

Demo password for seeded accounts: `ChangeMe123!`

- Super Admin: `super@ypms.test`
- Owner: `owner@accra.test`
- Manager: `manager@accra.test`
- Cashier: `cashier@accra.test`
- Designer: `designer@accra.test`
- Accountant: `accountant@accra.test`

## Useful Commands

```powershell
npm.cmd run lint
npm.cmd run test
npm.cmd run build
npm.cmd run docs:generate
```

Generated Word docs live in `docs/word`.
