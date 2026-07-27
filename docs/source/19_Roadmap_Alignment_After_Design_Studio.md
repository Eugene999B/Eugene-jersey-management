# Roadmap Alignment After the Design Studio Production Suite

Updated: 2026-07-27

## Why this note exists

The confirmed project plan remains the source of truth. The Design Studio Production Suite was deliberately split into several focused implementation pull requests because reliability, editing, transforms and machine output were too risky for one enormous change.

The GitHub PR numbers therefore do not redefine the commercial roadmap headings.

## Current position

The current branch completes the final machine-output slice of the planned Design Studio Production Suite:

- shop-owned machine profiles
- machine bed, origin, units, baud and mirror settings
- authoritative machine-setting snapshots in saved designs
- vector-only cut-path preparation
- SVG-cut, HPGL/PLT and DXF export
- fail-closed handling for live text, raster artwork and unsupported SVG

## Confirmed next route

After this branch is validated, merged and deployed, implementation returns to the confirmed plan in this order:

1. CEO Settings and Platform Governance
2. SMS and WhatsApp Credit Marketplace
3. Admin Investigation and Support Command Centre
4. Shop and Supplier Registration
5. High-Tech Marketplace and Nearby Shops
6. Commercial Launch Hardening

Provider credentials and controlled Paystack/Arkesel/WhatsApp production tests remain separate operational work and must not be confused with the feature sequence.

## Engineering boundaries

Client Design Studio components may import only browser-safe machine-profile definitions and pure helpers. Prisma, database access and default-profile creation remain in a server-only module used by authenticated pages and API routes. This boundary must be preserved in future production tooling.

The production build must validate this separation so database code can never enter the browser bundle.

## Working rule

Future release planning must name both:

- the GitHub PR/release number used for engineering history; and
- the confirmed roadmap phase being implemented.

This prevents a focused technical split from changing the business plan or causing the next route to be forgotten.
