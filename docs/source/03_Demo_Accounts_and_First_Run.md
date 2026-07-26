# Sports Shop Platform - Local Demo Accounts and First Run

This guide applies only to an intentional local demo database created with `npm run setup:demo`. Production deployment retires these identities automatically.

## Demo Password

Before running the local demo seed, set `SEED_DEMO_PASSWORD` in the local `.env` file to a unique password of at least 12 characters. No demo password is stored or published in this repository.

Never reuse a production, email, GitHub, banking, or personal password for demo data.

## Local Demo Accounts

The local seed creates these non-production identities:

- `super@ypms.test` - local Super Admin
- `owner@accra.test` - local shop Owner
- `manager@accra.test` - local Manager
- `cashier@accra.test` - local Cashier
- `designer@accra.test` - local Designer
- `accountant@accra.test` - local Accountant
- `supplier@accra.test` - local Supplier portal

These addresses must never be used as real production identities. `production:activate` deactivates them and invalidates their sessions during Railway deployment.

## Local First Run Checklist

- Seed only a disposable local database.
- Sign in with the local Super Admin and confirm the shop list appears.
- Sign out, then sign in with the local Owner account.
- Open Catalog and create a test product.
- Open POS, add a product to the cart, choose Cash, and complete the sale.
- Open POS again, choose Store Credit, enter a test customer, due date, and instalment count, then confirm the debt appears in Debts.
- Open Orders and move the demo order through the production board.
- Open Designs and test the production view, cutter profile, heat press preset, SVG export, job JSON export, and PLT export.
- Open Suppliers, review the seeded supplier, create a purchase order, and receive it to increase stock.
- Open Daily Closing, enter counted cash, and export the closing report.
- Open Exports and download PDF, Word, and Excel-compatible reports.
- Open `/track/APS-10001` to see the local public tracking page.
- Sign in with the local supplier account and confirm `/supplier` shows purchase orders.

## Production Rule

Production uses the real administrator defined by Railway `ADMIN_*` variables. See `docs/source/11_Production_Activation.md`. Do not run `setup:demo` or `db:seed:demo` against the Railway production database.

## Common Local Issues

- If login fails with a database error, confirm PostgreSQL is running and `DATABASE_URL` is correct.
- If npm is blocked in PowerShell, run `npm.cmd` instead.
- If Docker is not installed, use `npx.cmd prisma dev ls` and copy the TCP database URL into `.env`.
- If Prisma fails after changing the schema, run `npm.cmd run db:generate`.
