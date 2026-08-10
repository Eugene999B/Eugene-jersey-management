# Phase 17 — Staging migration, rollback and production acceptance

Phase 17 is the final release-safety phase for Eugene Shop Management. It separates three concerns that must never be confused:

1. **application deployment** — the Next.js image and runtime variables;
2. **database migration** — durable PostgreSQL schema/data changes applied by Prisma;
3. **database recovery** — backup/PITR restore when a release damages durable data.

Rolling the application image back does not reverse an already-applied Prisma migration. Production release decisions therefore require a staging deployment and a database recovery point before cutover.

## Repository release controls

Railway reads `railway.toml` and executes:

```text
npm run deployment:predeploy
```

The predeploy command resolves the deployment tier from `RAILWAY_ENVIRONMENT_NAME` unless `ESM_DEPLOYMENT_TIER` is explicitly set.

### Production environment

An environment named `production` runs, in order:

1. `prisma migrate deploy`;
2. `production:activate`;
3. `production:purge-demo` — still guarded by the exact one-time confirmation value;
4. `release:verify-db`.

The final verifier refuses to pass if:

- Prisma has no migration history;
- an unfinished migration exists;
- there is no active shop-independent platform `SUPER_ADMIN`;
- active seeded demo staff/buyer access remains exposed;
- the seeded demo shop is still active or publicly orderable;
- an E2E browser-acceptance tenant marker exists in production.

### Staging and non-production Railway environments

Every Railway environment whose name is not exactly `production` is treated as staging unless an explicit tier override is supplied.

Staging runs:

1. `prisma migrate deploy`;
2. `release:verify-db`.

It **does not** run production administrator activation and **does not** run permanent demo cleanup.

This makes it safe to use an isolated staging database with staging-only identities and test data.

## CI migration and recovery rehearsal

The normal GitHub validation pipeline now includes two release gates beyond the existing migration/unit/build/browser coverage.

### Staging predeploy rehearsal

CI executes `deployment:predeploy` with:

```text
RAILWAY_ENVIRONMENT_NAME=staging
```

This proves the real Railway predeploy command remains migration-safe and cannot accidentally invoke production activation or destructive demo cleanup on staging.

### PostgreSQL backup/restore rehearsal

After the full representative E2E seed is present, CI runs:

```text
npm run release:verify-recovery
```

The recovery rehearsal:

1. refuses `NODE_ENV=production`;
2. refuses a Railway environment named `production`;
3. refuses `ESM_DEPLOYMENT_TIER=production`;
4. requires CI or the explicit local `RECOVERY_REHEARSAL=true` flag;
5. accepts only loopback PostgreSQL hosts;
6. creates a custom-format `pg_dump` archive using PostgreSQL 16 tools;
7. creates a disposable recovery database;
8. restores the archive with `pg_restore`;
9. compares the row count of every public table;
10. compares the complete Prisma migration-name/checksum/completion/rollback history;
11. drops the disposable recovery database and deletes the temporary archive.

Any mismatch fails the pull request before Chromium acceptance.

This rehearsal proves the repository's database can be backed up and restored with representative ESM data. It does not replace Railway production backups/PITR; it verifies that the recovery mechanism and data shape are restorable before release.

## Railway staging environment

Use a persistent Railway staging environment with its own service variables and its own PostgreSQL database. Never point staging at the production `DATABASE_URL`.

Recommended staging controls:

- environment name: `staging`;
- separate PostgreSQL service/database;
- staging-only `SESSION_SECRET` and `TWO_FACTOR_ENCRYPTION_KEY`;
- staging `APP_URL`;
- staging administrator identity/password;
- provider sandbox/test credentials where available;
- no production `PURGE_DEMO_DATA` confirmation;
- production secrets copied only when the provider explicitly supports safe non-production use.

Railway variables that are sealed or intentionally production-only may need to be configured separately in the staging environment.

## External staging acceptance

The repository includes `.github/workflows/staging-acceptance.yml`.

Run **Verify Railway Staging Release** manually after Railway reports a healthy staging deployment. Provide the staging HTTPS URL as the `base_url` workflow input.

The GitHub repository must have a protected environment named `staging` with these secrets:

```text
STAGING_ADMIN_LOGIN_ID
STAGING_ADMIN_PASSWORD
```

The workflow sets `E2E_EXTERNAL=true`, so Playwright targets the supplied Railway URL and does not start the local Next.js server.

The staging smoke journey is intentionally read-only and verifies:

1. `GET /api/health` returns HTTP 200;
2. health JSON reports `status=ready` and `database=connected`;
3. the staging administrator can authenticate through the real login page;
4. `/admin` loads the command centre;
5. `/admin/reports` loads platform management reporting;
6. `/admin/integrations` loads production integration health;
7. `/shops` loads the public ESM marketplace.

Do not promote the release to production if this external staging workflow fails.

## Production recovery point

Immediately before production cutover, create or verify a Railway PostgreSQL recovery point appropriate to the service plan:

- confirm scheduled/manual backups are healthy; and/or
- confirm PostgreSQL point-in-time recovery is available and note the intended pre-release timestamp.

Record:

- release commit SHA;
- current production deployment identifier;
- pre-release database recovery timestamp/backup;
- person performing the cutover;
- any one-time production variables such as `PURGE_DEMO_DATA`.

## Production cutover sequence

1. Confirm the Phase 17 PR is fully green.
2. Deploy the exact candidate commit to isolated Railway staging.
3. Run the external staging acceptance workflow and retain its artifact.
4. Confirm provider/integration status appropriate for the launch scope.
5. Confirm a production database backup/PITR recovery point.
6. Promote/merge the exact accepted commit to production.
7. Watch Railway predeploy logs: migrations → production activation → guarded cleanup → release DB verification.
8. Wait for Railway `/api/health` to become healthy.
9. Sign in as the real production platform administrator.
10. Verify `/admin`, `/admin/reports`, `/admin/integrations`, `/shops`, and one real tenant dashboard.
11. Verify no E2E tenant or demo access is exposed.
12. Remove any one-time `PURGE_DEMO_DATA` variable after successful cleanup.
13. Retain the deployment, CI, staging-acceptance and backup/PITR evidence for the release record.

## Rollback decision tree

### A. New application fails before database migration completes

If Railway predeploy fails, the new application should not become the active deployment. Fix the migration/configuration failure and redeploy. Do not mark a failed migration as resolved unless the database state has been inspected.

### B. New application is unhealthy, but durable data/schema are compatible with the previous application

Roll back the Railway deployment to the previously known-good application image/variables. Verify `/api/health`, administrator login and tenant operations after rollback.

### C. Migration completed and the previous application is not compatible with the new schema

Do **not** rely on application rollback alone. Either:

- deploy a forward-compatible hotfix that works with the migrated schema; or
- restore/recover the database to the recorded pre-release backup/PITR timestamp and then restore the matching previous application deployment.

### D. Release caused incorrect or destructive durable data changes

Stop writes where operationally possible, identify the required recovery point, restore the database using Railway backup/PITR procedures, validate the restored database, and deploy the application commit compatible with that restored schema/data.

Never improvise destructive SQL against production as a substitute for a rehearsed recovery path.

## Complete production acceptance

After production cutover, the minimum acceptance is:

- database health and migrations are clean;
- platform administrator login works;
- tenant login and tenant isolation remain intact;
- public marketplace/storefront pages respond;
- business and platform reports load;
- production integration-health page loads and accurately reports configured/unconfigured providers;
- one representative order/payment/production path appropriate to the live provider configuration is verified;
- scheduled reservation release is configured and heartbeat evidence is visible when enabled;
- durable media storage is configured for production;
- no seeded credentials, E2E tenants or demo storefront remain exposed;
- production backup/PITR recovery is confirmed.

External real-money/provider actions must be controlled tests with the actual provider accounts. CI must never fabricate a successful real Paystack settlement, Arkesel delivery or physical cutter connection.

## Definition of done

ESM is release-complete only when all of the following are true:

1. normal GitHub validation is green;
2. staging-predeploy rehearsal is green;
3. PostgreSQL backup/restore rehearsal is green;
4. full local Chromium acceptance is green;
5. the exact candidate commit is deployed to an isolated Railway staging environment;
6. external staging acceptance is green;
7. a production database recovery point is confirmed;
8. the accepted commit is deployed to production;
9. post-deploy production smoke checks are green.

If items 5–9 have not been performed against the real Railway environments, the repository is **release-ready** but the production rollout is not yet certified complete.
