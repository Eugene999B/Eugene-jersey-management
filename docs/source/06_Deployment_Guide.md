# Sports Shop Platform - Deployment Guide

Recommended deployment path, environment variables, and production migration notes.

## Recommended Hosting

For the simplest production path, deploy the Next.js app on Vercel and use a managed PostgreSQL provider such as Supabase or Neon. This matches the roadmap, keeps deployment simple, and avoids managing servers at launch.

For a larger team or strict infrastructure control, deploy the same app to AWS, Azure, GCP, or a container platform, but that increases operational work.

## Why Vercel Plus Managed Postgres

- Vercel is built for Next.js application deployment and environment variable management.
- Managed Postgres providers handle backups, connection strings, metrics, and scaling knobs.
- Supabase provides connection pooling through Supavisor, which is useful for serverless environments.
- Neon provides Prisma guidance and serverless Postgres workflows.

## Production Environment Variables

- DATABASE_URL: production PostgreSQL connection string.
- SESSION_SECRET: long random secret, never reused from development.
- APP_URL: production URL.
- PAYSTACK_SECRET_KEY and PAYSTACK_PUBLIC_KEY: set when payment provider is ready.
- NOTIFICATION_PROVIDER: console, twilio, africastalking, or another provider once implemented.

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
- Create the production PostgreSQL database.
- Set environment variables in the hosting platform.
- Run migrations through CI/CD.
- Deploy the app.
- Create the first Super Admin with a secure password if not using demo seed data.
- Run smoke tests for login, catalog, POS, orders, reports, and tracking.
