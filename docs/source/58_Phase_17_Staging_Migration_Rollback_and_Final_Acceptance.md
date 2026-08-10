# Phase 17 — Staging, migration, rollback and final acceptance

Phase 17 is the final software release gate for Eugene Shop Management (ESM). It does not add another business subsystem. It proves that the release can be migrated, backed up, restored and exercised across the major human workflows before the release is accepted for production.

## Release principle

A phase is not complete because it builds locally or because one page renders. The final release must prove all of the following:

1. migrations are fully applied,
2. production activation remains idempotent and demo access remains retired,
3. existing tenant/order/payment/production records survive the release rehearsal,
4. a database backup can be restored into a separate database,
5. the restored database reports the same Prisma migration state,
6. protected canary business/order/payment/inventory facts match byte-for-byte after restore,
7. the full unit and tenant-isolation suites pass,
8. the production build and standalone runtime pass,
9. the full Chromium suite passes,
10. owner, buyer/public, production/reporting and platform-admin routes survive one final release sweep on desktop and mobile.

## Railway production order

`railway.toml` remains authoritative for production deployment:

1. Railpack build runs Prisma generation and the production build.
2. Railway pre-deploy runs `prisma migrate deploy`.
3. Production activation creates/updates the real administrator from Railway variables and retires demo access.
4. Guarded demo purge removes/suspends remaining demo material under the production safety rules.
5. The standalone Next.js server starts on `0.0.0.0`.
6. Railway checks `/api/health` before considering the release healthy.
7. The service uses the existing always-restart policy.

The migration/activation/purge sequence must not be moved into browser code or normal request handling.

## Automated release rehearsal

GitHub validation now performs a database rollback rehearsal in addition to normal migrations and tenant-isolation testing.

### Canary data

The rehearsal script is guarded by both:

- `PHASE17_RELEASE_REHEARSAL=true`, and
- a hard refusal when `NODE_ENV=production`.

It creates a dedicated non-public canary tenant with deterministic IDs and records for:

- business identity,
- category/product/exact variant,
- customer,
- completed online order,
- successful payment,
- production inventory,
- posted physical material-use movement.

The canary is intentionally isolated from real E2E businesses and is never intended for production.

### Fingerprint

The rehearsal reads the canary through Prisma and freezes a canonical JSON payload containing business, product, customer, order, successful payment and production-inventory facts. A SHA-256 fingerprint is stored as CI evidence.

The fingerprint contains fixed financial/production truth including:

- order value: 80,
- collected payment: 80,
- production material used: 0.5 metre,
- material use cost: 6.4.

### Backup and restore

After the ordinary migration and test gates, CI:

1. runs `prisma migrate status`,
2. seeds the Phase 17 canary,
3. captures its fingerprint,
4. creates a PostgreSQL custom-format `pg_dump`,
5. creates a separate `phase17_restore` database,
6. restores the dump with ownership/privilege rewriting disabled,
7. points Prisma at the restored database,
8. runs `prisma migrate status` again,
9. recomputes the canary fingerprint from the restored database,
10. fails the release if any protected fact changes,
11. deletes the temporary restore database.

The fingerprint and rehearsal log are retained as GitHub Actions evidence. The database dump itself is not published as an artifact.

## What the rollback rehearsal proves

The automated rehearsal proves that the current migrated ESM database can be backed up and restored with its protected application data intact and with Prisma still recognizing the migration state.

It does **not** claim that GitHub CI is a live Railway staging service. Production/staging infrastructure credentials, volumes, domains and provider integrations remain external to the repository and must be checked in their actual environment.

## Staging cutover protocol

Before a broad paid-shop release, use a Railway staging service or equivalent isolated environment that mirrors production configuration without using the production database.

1. Deploy the exact commit that passed GitHub validation.
2. Restore a current sanitized/authorized staging copy of production data or an approved representative backup.
3. Run `prisma migrate deploy` only; never use `prisma db push` for production/staging release migration.
4. Confirm `prisma migrate status` reports no pending/failed migration.
5. Confirm `/api/health` is healthy.
6. Confirm the unrestricted administrator can open `/admin/integrations`.
7. Confirm the owner can log in and open dashboard, catalogue, orders, production, stock and reports.
8. Confirm a buyer can browse the marketplace and open customer production tracking.
9. Complete one controlled store payment against the intended Paystack test/controlled route when provider credentials are available.
10. Complete one controlled SMS/WhatsApp delivery only when the real provider test account/consent configuration is available.
11. Connect the real cutter from a compatible browser and run the operator-confirmed test cut for the exact validated machine profile before relying on direct cutting for production.

## Rollback decision tree

### Application failure before migration

If build or pre-deploy fails before migrations complete, do not promote the release. Keep the currently healthy Railway deployment serving traffic.

### Application failure after migration but before healthy promotion

1. Stop promotion.
2. Preserve the failing deployment logs and exact commit SHA.
3. Determine whether the release migration is additive/backward-compatible with the currently deployed application.
4. If compatible, redeploy the previous known-good application commit against the forward-migrated database.
5. If incompatible or uncertain, enter maintenance mode and restore the verified pre-deploy database backup to an isolated database first; validate it before replacing production.

### Data integrity failure

If tenant counts, financial records, stock records or the protected release fingerprint change unexpectedly:

1. do not continue normal writes,
2. place the platform in maintenance mode,
3. preserve the affected database and logs for investigation,
4. restore the known-good backup to an isolated database,
5. verify migrations and critical tenant/order/payment/stock facts,
6. only then perform the controlled production database replacement according to Railway/PostgreSQL operating procedures.

Never attempt to “undo” a Prisma migration by manually deleting migration-table rows or editing production tables ad hoc.

## Final Chromium acceptance

The existing complete Playwright suite remains mandatory. Phase 17 adds a final release sweep that explicitly verifies:

### Owner/business workspace

- dashboard,
- catalogue,
- orders,
- customers,
- Design Studio,
- production materials,
- cutter operations,
- production stock/costing,
- customer production queue,
- management reports,
- settings.

### Public/buyer

- ESM marketplace,
- verified shop storefront,
- public custom-production request page,
- authenticated buyer custom-production request list.

### Platform administrator

- command centre,
- platform reports,
- integration health,
- businesses,
- support cases,
- activity,
- security,
- platform settings.

Every route must return a successful document response and must not render a known Next.js server-error surface.

The owner release sweep runs again at **390 × 844** and fails if the document has horizontal overflow.

## Production data preservation rules

1. Production migrations must use committed Prisma migrations.
2. `prisma db push` is not a production migration mechanism.
3. Demo seed remains opt-in and production activation is separate.
4. The Phase 17 release rehearsal refuses to execute in production.
5. Backups are verified by restore, not by file existence alone.
6. A rollback backup is considered useful only after the restored database passes migration status and protected-data verification.
7. Tenant/order/payment/stock data must never be replaced by demo or E2E seed data during deployment.
8. Provider secrets and customer data must not be copied into public CI artifacts.

## Final human hardware/provider acceptance

Software automation cannot truthfully emulate the actual physical vinyl cutter, the operator's blade/origin/material setup, or real third-party settlement/delivery credentials.

Before declaring a specific physical shop installation fully commissioned:

- identify and save the exact cutter profile/protocol,
- connect from the supported browser/Windows environment,
- perform an operator-confirmed test cut on scrap material,
- confirm the real design dimensions and mirror/origin behavior,
- complete the heat-press workflow on a controlled sample,
- perform controlled provider tests for any Paystack/SMS/WhatsApp route the shop will use.

These are commissioning checks, not reasons to weaken or bypass the automated release gate.

## Phase 17 completion criteria

Phase 17 may merge only when the exact head commit has green results for:

- dependency/security policy,
- Prisma generation,
- migration deploy,
- guarded demo lifecycle,
- lint,
- TypeScript,
- complete unit suite,
- tenant isolation,
- Phase 17 backup/restore fingerprint rehearsal,
- documentation generation,
- production build,
- standalone runtime dependency audit,
- browser dependency audit,
- E2E seed,
- complete Chromium suite including the Phase 17 final release sweep.

After merge, Railway production must be verified at the deployed commit and `/api/health`/critical pages must be checked before the release is treated as complete.
