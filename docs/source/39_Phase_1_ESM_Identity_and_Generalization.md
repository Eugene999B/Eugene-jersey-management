# Phase 1 — Eugene Shop Management identity and generalization

## Release purpose

This release changes the public platform identity from Eugene Jersey Management to **Eugene Shop Management (ESM)** and makes the core application suitable for general retail, wholesale, service, production, printing, rental and mixed businesses.

## Data-safety rules

- Existing shops, users, products, variants, customers, orders, payments, debts, subscriptions, production jobs and audit history are preserved.
- Existing tenant rows receive `MIXED` as their business type. No tenant is reclassified from old sports data by assumption.
- Existing sports fields remain in the database and remain readable. They are now grouped under an optional sports-shop template instead of being presented as universal fields.
- Legacy technical identifiers such as the production session-cookie names, historic payment-reference prefixes and the default administrator Login ID remain unchanged in this phase so active sessions, payment reconciliation and administrator access are not broken.
- The old `/brand/ejm-*` asset paths remain compatibility aliases, but they render the new ESM artwork. New application code uses `/brand/esm-*`.

## Business types

New businesses must choose one of the following types:

- Retail
- Wholesale
- Services
- Production / printing
- Rental
- Mixed business

The type is stored on the tenant and on shop applications. It establishes future terminology and module recommendations; it does not delete features or records.

## Identity changes

The ESM name and visual identity now apply to the homepage, authentication, administrator workspace, marketplace, application flow, browser metadata, web-app manifest, favicon, transactional email, SMS fallback sender, invoices, exports and generated operating guides.

## Catalogue changes

The default catalogue now offers general item types:

- Stocked product
- Service
- Custom production item
- Rental asset
- Bundle
- Non-stock item
- Garment
- Equipment

Sports product types, sport and team remain available inside an explicitly optional sports-shop section. Existing saved values remain compatible.

## Deployment

The migration is additive. Railway applies the new enum, tenant field, application field and indexes before the application starts. Existing tenants default to `MIXED`.
