# Eugene Shop Management — Deployment Guide

ESM is one full-stack Next.js application backed by PostgreSQL. Server actions, API routes, authentication, Prisma access, public storefronts, buyer flows and tenant/admin workspaces deploy together.

## Recommended hosting

Use Railway for the Next.js service and PostgreSQL. Cloudflare may sit in front for DNS, TLS, WAF, proxying and caching, but the current application is not a separate static frontend plus API backend.

The repository's `railway.toml` defines:

- build: `npx prisma generate && npm run build`;
- predeploy: `npm run deployment:predeploy`;
- start: the Next.js standalone server on `0.0.0.0`;
- health check: `/api/health`;
- restart policy: always.

## Required environments

Maintain separate Railway environments for **staging** and **production**. Each environment must have its own PostgreSQL database. Staging must never share production `DATABASE_URL`.

Railway exposes the environment name to the service. ESM treats an environment named exactly `production` as production and any other Railway environment as staging unless `ESM_DEPLOYMENT_TIER` explicitly overrides the tier.

### Staging

Staging predeploy runs Prisma migrations and release database verification only. It intentionally skips:

- production Super Admin activation;
- production demo retirement/purge.

Use staging-only credentials, URLs and provider test/sandbox configuration.

### Production

Production predeploy runs:

```text
prisma migrate deploy
production:activate
production:purge-demo
release:verify-db
```

The purge remains a guarded one-time operation and skips unless the exact confirmation value is present.

## Important production variables

Core:

- `DATABASE_URL`
- `SESSION_SECRET`
- `TWO_FACTOR_ENCRYPTION_KEY`
- `APP_URL`

Production administrator:

- `ADMIN_EMAIL`
- `ADMIN_LOGIN_ID`
- `ADMIN_NAME`
- `ADMIN_PHONE`
- `ADMIN_PASSWORD` for first creation or intentional reset only
- `ADMIN_FORCE_RESET=false` normally

Payments/integrations as enabled:

- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_PUBLIC_KEY`
- per-shop Paystack subaccount configuration in the application
- SMS/Arkesel variables
- transactional email variables
- WhatsApp variables
- durable media-storage variables
- `JOBS_API_TOKEN`

Optional:

- `ESM_DEPLOYMENT_TIER` — normally blank because Railway's environment name is authoritative.

## Production database migrations

Production and staging use Prisma migration history:

```text
npx prisma migrate deploy
```

Do not use `prisma db push` as a production release mechanism.

Every normal PR validates migrations against disposable PostgreSQL before merge.

## Database recovery rehearsal

CI also performs a real PostgreSQL custom-format backup and restore after representative E2E data has been seeded:

```text
npm run release:verify-recovery
```

The rehearsal compares every public table row count and the full Prisma migration history after restore. It is hard-blocked against production and non-loopback databases.

This CI rehearsal proves the repository/data shape is restorable; production still requires Railway backup/PITR protection.

## Staging acceptance

After an exact candidate commit is deployed to Railway staging, run the GitHub workflow:

**Verify Railway Staging Release**

Configure a protected GitHub environment named `staging` with:

```text
Variable: STAGING_BASE_URL=https://your-railway-staging-host
Secret:   STAGING_ADMIN_LOGIN_ID
Secret:   STAGING_ADMIN_PASSWORD
```

The URL is pinned in the protected environment rather than supplied as a free-form workflow input, preventing staging credentials from being sent to a manually mistyped host.

The workflow verifies health, staging administrator login, platform reports, production integration health and the public marketplace against the real staging service.

## Production cutover

Before production deployment:

1. Confirm the normal PR validation pipeline is green.
2. Deploy the exact candidate commit to isolated staging.
3. Pass the external staging acceptance workflow.
4. Confirm a Railway PostgreSQL backup/PITR recovery point.
5. Record the release commit and pre-release database recovery timestamp/backup.
6. Deploy/merge the exact accepted commit to production.
7. Confirm the Railway predeploy sequence succeeds.
8. Confirm `/api/health` is ready.
9. Sign in with the real platform administrator.
10. Verify platform reports, integration health, marketplace and a real tenant workspace.

## Rollback rule

Application rollback and database recovery are separate operations.

- If the new application is bad but the migrated schema remains compatible with the previous application, roll the Railway deployment back and run smoke tests.
- If the migration made the old application incompatible, application rollback alone is unsafe. Deploy a compatible forward fix or restore the database to the pre-release recovery point and then restore the matching application deployment.
- If durable data was corrupted, restore from Railway backup/PITR before resuming writes.

See `58_Phase_17_Staging_Migration_Rollback_and_Production_Acceptance.md` for the complete decision tree and final acceptance definition.

## Paystack settlement plan

- The ESM administrator owns the main Paystack integration.
- Each card-enabled store must use its own configured Paystack subaccount/settlement destination.
- Shop settlement routing is verified and assigned by the authorized platform billing administrator.
- The Paystack secret key remains a Railway secret and must never be stored in the frontend or tenant database settings.

## Production launch checklist

- staging and production use separate PostgreSQL databases;
- required environment variables are present in the correct environment;
- migrations pass in CI and staging;
- staging external acceptance passes;
- production backup/PITR is confirmed;
- real production administrator access is verified;
- demo/E2E identities are not exposed;
- durable media storage is configured;
- Paystack/provider health reflects the intended launch scope;
- reservation scheduler is configured when reservations are enabled;
- production `/api/health` returns ready;
- post-deploy tenant/public smoke checks pass.
