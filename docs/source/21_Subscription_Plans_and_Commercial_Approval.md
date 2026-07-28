# Subscription Plans and Immediate Commercial Saves

Updated: 2026-07-28

## Purpose

The platform uses one authoritative four-tier subscription catalogue instead of arbitrary per-shop pricing. The current platform owner is the sole administrator, so authenticated Billing changes apply immediately when saved.

The catalogue defines `FREE`, `BASIC`, `PRO` and `ENTERPRISE`. Migration placeholders do not invent business prices. A tier remains unavailable until the administrator configures and activates it.

## Plan terms

Each saved plan version records:

- tier and public name
- description and currency
- monthly and yearly price
- trial duration
- past-due grace period
- included staff accounts
- maximum products
- maximum monthly orders
- enabled feature entitlements
- configured, public and active state
- immutable version number

Blank product and order limits mean that no limit is currently enforced. Only included staff accounts are enforced in this release.

## Sole-administrator save rule

1. The authenticated administrator edits the plan and provides a written reason.
2. Saving applies the new terms immediately.
3. The save records the previous and new terms in the commercial change history.
4. Every save creates a new immutable `SubscriptionPlanVersion`.
5. Concurrent or stale saves fail closed when the plan version changed after the page loaded.
6. There is no second-administrator or self-approval step.

## Existing tenant safety

The migration creates one `ShopSubscriptionContract` for every existing shop and preserves its current plan tier, billing cycle, status, monthly price, yearly price and renewal date.

Catalogue changes never silently reprice an existing tenant. The administrator must explicitly assign a saved plan version to the shop. Assignment records a written reason and copies the saved price, limits, trial/grace rules and feature terms into the tenant contract snapshot.

The existing billing fields on `Shop` remain synchronized for application compatibility while the versioned contract is the commercial source of truth.

## New tenant rule

New shops can only be created from a configured and active saved plan. The shop creation form does not accept arbitrary monthly or yearly prices. Trial end and initial renewal date come from the saved plan version.

## Staff-account enforcement

The included-staff limit counts:

- active non-owner staff accounts
- open unexpired staff invitations

The owner account is excluded. Direct staff creation, invite creation and invite acceptance use serializable platform transactions to prevent concurrent over-allocation. When all slots are reserved, the operation fails closed with a clear plan-limit message.

## Security boundary

`SubscriptionPlan`, `SubscriptionPlanVersion`, `SubscriptionPlanChangeRequest` and `ShopSubscriptionContract` are platform-commercial data. Normal and interactive shop tenant clients are denied direct access. Tenant workspaces use narrowly reviewed entitlement repository operations instead of the unrestricted platform database client.

The existing change-request table is retained as an immutable before/after history record. A sole-administrator save records the same authenticated administrator as requester and decision-maker because no separate approval workflow exists.

## Scope boundary

This release establishes the plan catalogue, immediate audited saves, versioning, assignment and staff-account limit. Product limits, monthly order limits, feature-route enforcement, automated renewal collection, invoicing, dunning and plan self-service remain controlled follow-up work.

## Validation requirements

- PostgreSQL migration and existing-price backfill
- Prisma generation and migration deployment
- immediate sole-administrator plan save
- stale-version denial and immutable saved versions
- explicit tenant assignment with plan snapshot
- staff creation/invite/acceptance capacity enforcement
- normal and interactive tenant-client denial
- unit tests, production build and Chromium desktop/mobile acceptance
