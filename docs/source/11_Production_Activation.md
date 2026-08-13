# Eugene Shop Management — Production Activation and Demo Cleanup

Updated: 2026-08-10

## Source of truth

Release activation is controlled by GitHub and Railway deployment. The repository now routes Railway predeploy through:

```text
npm run deployment:predeploy
```

The command resolves the Railway environment before it performs any production-only action.

## Staging behavior

A Railway environment whose name is not exactly `production` is treated as staging unless `ESM_DEPLOYMENT_TIER` explicitly overrides it.

Staging predeploy runs:

```text
npx prisma migrate deploy
npm run release:verify-db
```

Staging deliberately does **not** run `production:activate` and does **not** run `production:purge-demo`. This prevents a staging deployment from creating/resetting the real production administrator or executing permanent demo cleanup.

Use a separate staging PostgreSQL database and staging-only administrator credentials.

## Production behavior

The Railway environment named `production` runs:

```text
npx prisma migrate deploy
npm run production:activate
npm run production:purge-demo
npm run release:verify-db
```

The final release verifier confirms Prisma migration history is complete, a real active shop-independent platform `SUPER_ADMIN` exists, demo access is not exposed and E2E tenant markers are absent.

## Required production administrator variables

```text
ADMIN_EMAIL
ADMIN_LOGIN_ID
ADMIN_NAME
ADMIN_PHONE
ADMIN_PASSWORD
ADMIN_FORCE_RESET=false
```

`ADMIN_EMAIL` must be a real production email address. `ADMIN_PASSWORD` must be at least 12 characters when the administrator is first created or intentionally reset.

The default login ID is `EJM-ADMIN-ROOT` when `ADMIN_LOGIN_ID` is not supplied.

## Production activation

The first production activation deployment:

1. Applies all Prisma migrations.
2. Creates the real platform Super Admin when it does not already exist.
3. Deactivates seeded demo staff identities.
4. Invalidates active demo staff sessions.
5. Deactivates the seeded demo buyer and supplier.
6. Suspends the seeded Accra Pro Sports demo shop.
7. Disables the demo storefront and public ordering.
8. Records activation in the audit log.
9. Runs release database verification before the app starts.

The activation process is idempotent. Later deployments keep the real administrator active and do not overwrite an existing password unless `ADMIN_FORCE_RESET=true`.

After the first successful real login, `ADMIN_PASSWORD` may be removed from Railway while `ADMIN_FORCE_RESET` remains `false`.

## Production login

Open `/login` and sign in with either:

- the value stored in `ADMIN_LOGIN_ID`, or
- the value stored in `ADMIN_EMAIL`.

A successful unrestricted platform administrator login redirects to `/admin`.

## Administrator password rotation

For an intentional password reset:

1. Set a new strong `ADMIN_PASSWORD` in the production Railway environment.
2. Set `ADMIN_FORCE_RESET=true`.
3. Deploy the production service once.
4. Confirm the new password opens `/admin`.
5. Set `ADMIN_FORCE_RESET=false`.
6. Remove `ADMIN_PASSWORD` from Railway after the new login is verified.

Do not set `ADMIN_FORCE_RESET=true` in staging as a substitute for managing a staging-only administrator identity.

## Permanent seeded demo cleanup

Do not drop the PostgreSQL database. Permanent cleanup preserves:

- the real production Super Admin;
- the Prisma migration table;
- every database table and production constraint;
- application configuration and future tenant capacity.

It permanently deletes only the known seeded demo business data, including the Accra Pro Sports tenant, its staff, products, stock, customers, orders, payments, supplier data, reviews, design jobs, messages and related tenant records. It also removes the seeded demo buyer and global demo Super Admin identity.

### Safety checks

Cleanup refuses to run unless:

- `ADMIN_EMAIL` identifies an active, shop-independent real `SUPER_ADMIN`;
- the production admin is not a seeded demo identity;
- every known demo staff identity is either global or attached only to the seeded demo shop;
- the seeded buyer has no orders, reviews, returns or cart records outside the seeded demo tenant;
- no demo staff identity is referenced by another tenant.

The command inventories demo records before deletion, runs cleanup in a database transaction, verifies that known demo markers are gone and records a final audit entry under the real administrator.

### One-time production procedure

Add this exact variable only to the **production** Railway environment:

```text
PURGE_DEMO_DATA=PURGE-ACC-PRO-DEMO-2026
```

Deploy once. A successful predeploy log includes:

```text
Production demo purge complete
```

After the application starts successfully:

1. Sign in with the real administrator.
2. Confirm `/admin` opens.
3. Confirm the demo shop and demo accounts no longer appear.
4. Remove `PURGE_DEMO_DATA` from production Railway variables.
5. Deploy the variable removal.

Leaving the variable absent or blank causes the purge command to skip safely.

Never copy the one-time purge confirmation into staging.

## Recovery and repeat behavior

The purge is designed as a one-time operation. If a production deployment is retried after cleanup already completed, it finds no remaining demo tenant and safely verifies the clean state.

The seeded demo can still be recreated in disposable local or CI databases with `db:seed:demo`; it must never be seeded into production.

Application rollback does not restore deleted or migrated database data. Before production cutover, follow the Phase 17 runbook and confirm a Railway PostgreSQL backup/PITR recovery point.

## Safety controls

- A tenant owner or shop worker cannot be promoted automatically.
- A seeded demo address cannot become the production administrator.
- A real account cannot be displaced when the requested Login ID is already assigned.
- Users connected to a suspended shop are rejected during login.
- Permanent demo cleanup requires an exact production Railway confirmation value.
- Staging predeploy cannot invoke production activation/purge through the normal Railway command.
- Cleanup never drops the production database or migration history.
- Production release verification rejects active demo access and E2E tenant markers.
