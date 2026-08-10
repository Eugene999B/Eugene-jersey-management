# Commercial Hardening — Session and Device Management

Updated: 2026-08-10

## Objective

This hardening release closes the remaining account-security roadmap gap for session history, device visibility and per-session forced logout. It applies the same security model to workforce accounts (platform administrators, shop owners, managers, workers and suppliers) and buyer accounts.

## Durable session model

Every successful authenticated login now creates an `AccountSession` record before the signed browser cookie is issued. The record stores:

- account kind (`USER` or `BUYER`);
- exact account ID;
- browser user-agent text when supplied by the request;
- request IP address when supplied through the trusted deployment request headers;
- creation time;
- last-seen time;
- expiry time;
- revocation time and reason when the session is ended.

The signed JWT contains the durable session ID as both the `sessionId` claim and JWT ID. A valid signature by itself is no longer enough: authenticated requests also require the matching durable record to exist, belong to the exact account, remain unrevoked and remain unexpired.

Workforce sessions retain the existing seven-day cookie lifetime. Buyer sessions retain the existing thirty-day lifetime. Last-seen writes are throttled to avoid a database update on every page request while still providing useful recent-activity evidence.

## Existing global revocation remains authoritative

The new per-device registry is an additional security layer, not a replacement for the existing global guards.

For workforce accounts, `User.sessionVersion` remains embedded in the signed token and checked against the current database user. Password changes, password recovery and two-factor enable/disable continue to invalidate all old tokens by advancing that version.

For buyer accounts, the existing buyer record version check remains in place. Credential/security changes that mutate the protected buyer record invalidate existing signed buyer tokens.

Those high-risk operations now also mark every durable `AccountSession` record for that account as revoked so the device-history view reflects what actually happened instead of showing invalid tokens as active sessions.

## Device management experience

`/account/security` and `/buyer/security` now include a **Your devices** panel.

For each recent session the account holder can see:

- a friendly browser and device label derived from the user-agent;
- whether it is the current device, another active device, signed out or expired;
- last activity;
- sign-in time;
- expiry or sign-out time;
- source IP when available from deployment request headers.

The panel displays the twenty most recent session records. Historical revoked/expired records are retained as security evidence rather than silently deleted by the normal account UI.

An account holder may:

1. sign out one exact device;
2. sign out the current device;
3. sign out every other currently active device while preserving the current session.

Every mutation is constrained server-side by the authenticated account kind and exact account ID. A submitted session ID cannot be used to revoke another user or buyer session. The account type posted by the UI only selects which authenticated cookie surface is being managed; it never supplies an account ID.

## Logout and audit behavior

Normal workforce and buyer logout now revoke the exact current `AccountSession` before clearing the cookie.

Manual per-device revocation writes `auth.session_revoked` to the audit trail. Signing out all other devices writes `auth.other_sessions_revoked` with the number of sessions affected. Password and two-factor audit behavior remains intact.

## Tenant isolation

`AccountSession` is platform-global security data. It is intentionally not registered in the tenant-scoped Prisma model map. Shop tenant clients and interactive tenant transactions therefore cannot use the generic tenant database client to browse or mutate session records. Session access goes only through the reviewed account-session repository after authentication resolves the exact account.

## Deployment compatibility

This migration is additive and does not rewrite shops, users, buyers, orders, payments, stock, production data or subscription records.

Existing pre-release browser cookies do not contain a durable `sessionId`. They intentionally fail the new token validation after deployment and require a one-time sign-in. This is safer than accepting untracked legacy sessions that could not be individually revoked or displayed in device history.

No `prisma db push` is required or permitted for production rollout. Railway continues to apply the checked-in migration through `prisma migrate deploy` before application activation and startup.

## Permanent validation

Validation covers:

- Prisma model and migration shape;
- staff and buyer JWT session-ID binding;
- durable-session creation after password and two-factor authentication;
- active/revoked/expired checks during authenticated requests;
- exact-session revocation on normal logout;
- durable global revocation after password changes, recovery and two-factor changes;
- authenticated account scoping for device actions;
- device history on workforce and buyer security pages;
- tenant-client denial for platform-global session data;
- browser acceptance using two simultaneous workforce contexts, revoking the second session while retaining the first;
- buyer mobile security rendering at 390 × 844 without horizontal overflow.

The release is eligible to merge only after migrations, lint, TypeScript, unit tests, tenant isolation, production build and Chromium acceptance pass on the exact pull-request head.
