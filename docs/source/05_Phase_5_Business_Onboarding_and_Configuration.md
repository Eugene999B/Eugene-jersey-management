# Phase 5 — Business onboarding and configuration

## Purpose

Phase 5 gives a newly created ESM business a guided setup workspace instead of placing the owner inside a large empty dashboard. The wizard writes to the same tenant records used by daily operations. It is not a separate checklist database.

## Data-safety rule

The migration marks every business that existed before Phase 5 as already complete. Their products, staff, stock, orders, customers, payments, subscriptions, modules and settings are unchanged.

Businesses created after the migration start with onboarding incomplete and receive a dashboard prompt. The prompt never blocks access to operational pages; an authorized owner or manager can continue setup from `/dashboard/setup`.

## Ten core steps

1. Business identity.
2. Business type.
3. Ghana operating location.
4. Enabled-module review.
5. Currency and default tax rate.
6. Accepted payment methods.
7. Thermal-receipt header and footer.
8. Staff and permission review.
9. First product or service.
10. Opening stock, or a service item that does not require stock.

The completion action validates real records on the server. It requires:

- steps 1–8 to have been saved;
- a Ghana location record;
- at least one enabled payment method;
- at least one product or service;
- positive stock for a stocked business, or a service item;
- the production extension when printing/production is active.

## Printing and production extension

A production business records:

- the cutter or plotter name currently known;
- the verified connection description, or an explicit “not yet verified” value;
- the manual heat press;
- materials;
- garment types;
- print locations;
- standard artwork-size notes;
- production stages;
- default deposit percentage.

The setup explicitly treats the heat press as manual and forbids guessing HPGL or another machine protocol. Electronic control remains blocked until the exact equipment and supported interface are verified under the Phase 0 safety gate.

## Receipt behavior

The configured short header and footer are escaped and printed on the tenant-scoped thermal receipt. No HTML supplied by the business is executed.

## Permissions and audit

The setup workspace uses the existing Settings permission. Catalogue creation still uses the existing catalogue-write permission and subscription/product-limit enforcement. Every saved setup section and final completion is audited against the business and user.

## Rollout verification

The release must pass:

- Prisma migration deployment on an empty database and an existing-tenant database;
- lint and TypeScript;
- the complete unit suite;
- tenant-isolation verification;
- production build;
- Chromium setup, navigation, receipt and responsive acceptance journeys;
- Railway deployment status for the exact merged commit.
