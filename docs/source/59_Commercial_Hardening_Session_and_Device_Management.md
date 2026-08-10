# Commercial Hardening — Session and Device Management

Updated: 2026-08-10

## Objective

This release adds durable session history, device visibility, and per-session sign-out for workforce and buyer accounts.

## Durable session model

Every successful authenticated sign-in creates an `AccountSession` record before the browser cookie is issued. It stores the account kind, exact account ID, authentication version, user-agent when available, request IP when available, creation time, last-seen time, expiry time, and any revocation time/reason.

The signed token carries the durable session ID as both `sessionId` and JWT ID. A valid signature alone is no longer sufficient. Authenticated requests also require the durable row to belong to the account, match the account's current authentication version, remain unrevoked, and remain unexpired.

Workforce sessions keep the existing seven-day lifetime. Buyer sessions keep the existing thirty-day lifetime. Last-seen writes are throttled to avoid unnecessary database writes.

## Global security-version reconciliation

The per-device registry is an additional layer over the existing global account-version checks.

For workforce accounts, `User.sessionVersion` remains authoritative. For buyer accounts, the existing buyer record version remains authoritative. Each `AccountSession` stores the version under which it was issued, and authenticated requests require that stored version to match the current account version.

When device history is loaded, any still-unrevoked row whose stored version is stale is recorded as revoked with reason `account-security-version-changed`. This means existing administrator and account-state operations that already invalidate sessions through the global version also reconcile correctly into device history without every caller needing direct access to the session table.

Credential and two-factor security changes also revoke all durable rows immediately as part of their existing all-session invalidation behavior.

## Device management experience

`/account/security` and `/buyer/security` include a **Your devices** panel. It shows a friendly browser/device label, current/active/signed-out/expired state, last activity, sign-in time, expiry or sign-out time, and source IP when deployment headers provide it.

The twenty most recent rows are shown. Revoked and expired rows remain available as security history.

An account holder can sign out one exact device, sign out the current device, or sign out every other active device while retaining the current session. The server derives the exact account ID from the authenticated account surface; the browser never submits an account ID for these operations.

## Logout and audit behavior

Normal workforce and buyer logout revokes the exact current `AccountSession` before clearing the cookie. Manual single-device revocation writes `auth.session_revoked`; signing out other devices writes `auth.other_sessions_revoked` with the affected count.

## Tenant isolation

`AccountSession` is platform-global security data and is intentionally absent from the tenant-scoped Prisma model registry. Tenant database clients cannot use the generic tenant access path to browse or mutate these rows. Session access goes through the reviewed account-session service after authentication identifies the exact account.

## Deployment compatibility

The migration is additive and does not rewrite shop business records. Existing pre-release browser cookies do not contain a durable `sessionId`, so they intentionally require a one-time sign-in after deployment instead of being accepted as untracked sessions.

Production rollout continues to use the checked-in migration through `prisma migrate deploy`; `prisma db push` is not part of the release path.

## Permanent validation

Validation covers the Prisma model and migration, authentication-version binding, JWT session IDs, session creation after authentication, active/version/revoked/expiry checks, stale-version reconciliation, exact logout revocation, all-session security revocation, account-scoped device actions, workforce and buyer device pages, tenant-client denial, a two-browser workforce revocation journey, and buyer mobile rendering at 390 × 844.

Merge eligibility still requires migrations, lint, TypeScript, unit tests, tenant isolation, the Phase 17 backup/restore rehearsal, documentation generation, production build, standalone runtime checks, and Chromium acceptance on the exact pull-request head.
