# Sports Shop Platform - Demo Accounts and First Run

Login details and the first workflows to test after seeding.

## Demo Password

All seeded demo users use the password ChangeMe123!. Change every password before real use.

## Accounts

- super@ypms.test - Super Admin - opens /admin
- owner@accra.test - Owner - full shop operations
- manager@accra.test - Manager - most shop operations
- cashier@accra.test - Cashier - POS and orders
- designer@accra.test - Designer - production order status workflow
- accountant@accra.test - Accountant - reports and financial visibility

## First Run Checklist

- Sign in as super@ypms.test and confirm the shop list appears.
- Sign out, then sign in as owner@accra.test.
- Open Catalog and create a test product.
- Open POS, add a product to the cart, choose Cash, and complete the sale.
- Open Orders and move the demo order through the production board.
- Open Reports and export CSV or use the PDF print button.
- Open /track/APS-10001 to see the public tracking page.

## Common Local Issues

- If login fails with a database error, confirm PostgreSQL is running and DATABASE_URL is correct.
- If npm is blocked in PowerShell, run npm.cmd instead.
- If Docker is not installed, use npx.cmd prisma dev ls and copy the TCP database URL into .env.
- If Prisma fails after changing the schema, run npm.cmd run db:generate.
