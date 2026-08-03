# Phase 6 — Administrator-controlled free access

## Purpose

Phase 6 separates administrator-approved access from ordinary recurring subscription billing. A business can receive a configured plan and its limits without generating misleading invoices or payment prompts during a sponsored, promotional, emergency or free period.

## Access types

- Paid subscription.
- Free trial.
- Sponsored access.
- Promotional access.
- Free forever.
- Temporary emergency access.
- Suspended access.

## Saved grant terms

Every grant records:

- business;
- access type;
- configured plan and immutable plan version;
- optional feature override;
- start date;
- optional end date;
- optional price override;
- whether invoices are disabled;
- administrator approval reason;
- approving administrator;
- expiry behavior;
- optional target plan;
- optional automatic-extension period;
- revocation and expiry history.

Only one active grant may exist for a business. A replacement grant revokes the previous active grant inside the same serializable transaction.

## Billing behavior

Free trial, sponsored, free-forever, emergency and suspended grants always disable subscription invoices. Promotional and paid grants may keep billing active or disable it explicitly.

When a no-invoice grant begins:

- open and overdue subscription invoices are voided with a recorded reason;
- invoice reminders are cleared;
- the owner cannot generate a renewal invoice;
- the owner cannot start subscription checkout;
- the business subscription page explains that invoices are disabled during the grant.

The plan snapshot and feature limits remain enforced. Free access does not silently create unlimited products, orders, staff accounts or unavailable modules.

## Expiry outcomes

A temporary grant must define what happens after expiry:

- extend automatically by a configured number of days;
- return to a configured Free plan;
- move to a configured paid plan and await payment;
- suspend commercial actions;
- wait for administrator review.

Expiry reconciliation is idempotent and runs before access or invoice decisions. Missing or invalid target plans fail closed to administrator review or suspension.

## Tenant and permission safety

The grant ledger is platform-global and cannot be queried through the tenant database client. The administrator page and both grant mutations require the platform Billing permission. Businesses only receive a derived, read-only explanation through their subscription centre.

Every grant and revocation is written to the platform audit log with its commercial terms and reason.

## Verification requirements

The release must pass:

- additive migration deployment;
- Prisma generation;
- lint and TypeScript;
- access-ledger architecture tests;
- complete unit tests;
- live two-shop tenant-isolation attacks;
- production build;
- mobile and desktop Chromium administrator-access journeys;
- Railway deployment for the exact merged commit.
