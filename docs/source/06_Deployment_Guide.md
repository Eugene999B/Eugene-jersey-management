# Sports Shop Platform - Deployment Guide

Recommended deployment path, environment variables, and production migration notes.

## Recommended Hosting

For the current codebase, deploy the full Next.js app and PostgreSQL database together on Railway. This app is not split into a separate static frontend and backend API; server actions, API routes, authentication, and Prisma database access live inside the Next.js app.

Cloudflare should be used first as DNS, SSL, proxy, CDN, and WAF in front of the Railway app. A separate Cloudflare frontend can come later only after the backend is refactored into a standalone API.

## Why Railway First

- Railway can host the Next.js service and PostgreSQL database in the same project.
- railway.toml already defines the build command, pre-deploy migration command, start command, healthcheck path, and restart policy.
- Keeping the app and database together reduces launch risk while the product is still moving fast.
- Cloudflare can still protect the public domain without splitting the codebase.

## Production Environment Variables

- DATABASE_URL: production PostgreSQL connection string.
- SESSION_SECRET: long random secret, never reused from development.
- APP_URL: production URL.
- PAYSTACK_SECRET_KEY: platform secret key used server-side to initialize payments.
- PAYSTACK_PUBLIC_KEY: public key used where a client-side Paystack flow is added.
- Per-shop Paystack subaccount codes: stored in each shop's Settings page, not as global environment variables.
- NOTIFICATION_PROVIDER: console, twilio, africastalking, or another provider once implemented.

## Paystack Settlement Plan

- Create or verify a Paystack subaccount for each shop that should receive online payments.
- Paste the shop's subaccount code into Dashboard > Settings > Payments.
- Set the platform transaction charge in pesewas if the platform keeps a fixed service fee from each transaction.
- Choose the Paystack charge bearer value in settings: subaccount, account, all, or all-proportional.
- Keep PAYSTACK_SECRET_KEY only in Railway variables. Do not store a secret key in the database or frontend.

## Production Database Migrations

Use prisma migrate deploy in CI/CD or the deployment pipeline for production migrations. Do not use prisma db push against production because it bypasses migration history.

```powershell
npx prisma migrate deploy
```

## Official References Checked

- Vercel environment variables: https://vercel.com/docs/environment-variables
- Next.js environment variables: https://nextjs.org/docs/app/guides/environment-variables
- Prisma production migrations: https://www.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate
- Supabase Postgres connections: https://supabase.com/docs/guides/database/connecting-to-postgres
- Neon Prisma guide: https://neon.com/docs/guides/prisma

## Deployment Checklist

- Commit code and push to GitHub.
- Create a Railway project from the GitHub repository.
- Add a Railway PostgreSQL database to the same project.
- Set DATABASE_URL, SESSION_SECRET, APP_URL, PAYSTACK_SECRET_KEY, and notification variables in Railway.
- Confirm railway.toml is detected and lets Railway run prisma migrate deploy before start.
- Deploy the app from GitHub.
- Point a Cloudflare-managed domain to the Railway service when the Railway URL is stable.
- Create the first Super Admin with a secure password if not using demo seed data.
- Run smoke tests for login, catalog, POS, credit sale, debts, daily closing, suppliers, design studio, exports, public ordering, and tracking.
