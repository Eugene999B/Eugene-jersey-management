# Subscription Plans and Commercial Approval

Updated: 2026-07-28

## Purpose

This release replaces arbitrary per-shop subscription pricing with an authoritative four-tier catalogue and controlled second-administrator approval.

The catalogue defines `FREE`, `BASIC`, `PRO` and `ENTERPRISE`. The migration does not invent business prices. Every tier begins as an inactive commercial placeholder until an administrator submits terms and a different billing administrator approves them.

## Plan terms

Each approved plan version records:

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

## Two-administrator rule

1. A billing administrator submits a written commercial proposal.
2. The proposal stores the previous and proposed terms.
3. The requester cannot approve the same proposal.
4. A different billing administrator approves or rejects it with a decision note.
5. Approval fails closed when the plan changed after the proposal was created.
6. An approved proposal creates a new immutable `SubscriptionPlanVersion`.
7. Rejection leaves the authoritative plan unchanged.

## Existing tenant safety

The migration creates one `ShopSubscriptionContract` for every existing shop and preserves its current plan tier, billing cycle, status, monthly price, yearly price and renewal date.

Catalogue changes never silently reprice an existing tenant. An administrator must explicitly assign an approved plan version to the shop. Assignment records a written reason and copies the approved price, limits, trial/grace rules and feature terms into the tenant contract snapshot.

The existing billing fields on `Shop` remain synchronized for application compatibility while the versioned contract is the commercial source of truth.

## New tenant rule

New shops can only be created from a configured and active approved plan. The shop creation form no longer accepts arbitrary monthly or yearly prices. Trial end and initial renewal date come from the approved plan version.

## Staff-account enforcement

The included-staff limit counts:

- active non-owner staff accounts
- open unexpired staff invitations

The owner account is excluded. Direct staff creation, invite creation and invite acceptance use serializable platform transactions to prevent concurrent over-allocation. When all slots are reserved, the operation fails closed with a clear plan-limit message.

## Security boundary

`SubscriptionPlan`, `SubscriptionPlanVersion`, `SubscriptionPlanChangeRequest` and `ShopSubscriptionContract` are platform-commercial data. Normal and interactive shop tenant clients are denied direct access. Tenant workspaces use narrowly reviewed entitlement repository operations instead of the unrestricted platform database client.

## Scope boundary

This release establishes the plan catalogue, approval, versioning, assignment and staff-account limit. Product limits, monthly order limits, feature-route enforcement, automated renewal collection, invoicing, dunning and plan self-service remain controlled follow-up work.

## Validation requirements

- reversible PostgreSQL migration and existing-price backfill
- Prisma generation and migration deployment
- proposal requester self-approval denial
- stale proposal denial and immutable approved versions
- explicit tenant assignment with plan snapshot
- staff creation/invite/acceptance capacity enforcement
- normal and interactive tenant-client denial
- unit tests, production build and Chromium desktop/mobile acceptance
