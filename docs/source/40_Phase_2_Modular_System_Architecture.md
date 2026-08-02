# Phase 2 — Modular system architecture

## Release purpose

Phase 2 changes ESM from one long, universal toolbox into a modular business platform. Every tenant keeps a dependable core workspace, while optional tools are activated only for businesses that need them and whose assigned plan includes the required capability.

## Universal core

Every business receives these eight modules:

- Home
- Sales
- Orders
- Items
- Customers
- Payments
- Reports
- Settings

Sales/POS and inventory are now treated as core capabilities at the application and PostgreSQL enforcement layers. Subscription status, product limits and monthly-order limits remain enforced; the plan no longer needs separate `POS` or `INVENTORY` feature flags to expose the core workflow.

## Optional module catalogue

The Phase 2 catalogue defines eight optional modules:

- Printing and production
- Services and job management
- Rentals and equipment hire
- Suppliers and purchasing
- Online selling
- Marketplace
- Multi-location stock
- Advanced accounting

Printing and production, suppliers and purchasing, online selling, and marketplace already have working routes and can be activated now. Services, rentals, multi-location stock and advanced accounting are registered as planned modules so later phases can extend the same architecture without exposing empty pages.

## Three-layer access rule

An optional tool is visible and usable only when all relevant conditions pass:

1. The user role permits the route.
2. The platform administrator enabled the module for that business.
3. The assigned subscription includes the module's required feature.

The same rule is applied to desktop navigation, mobile navigation and direct route requests. A disabled module is removed from navigation; manually entering its URL redirects to the business module and plan screen.

## Administrator control

The platform administrator's business detail page now shows:

- Eight always-on core modules.
- Available optional modules with enable/disable checkboxes.
- The plan feature required by each available module.
- Later-phase modules as read-only planned capabilities.

Every change is written to the audit log as `admin.shop_modules_updated`, including the previous and next module sets.

## Business-owner visibility

The Modules, plan and usage page shows each capability as one of:

- Core
- Active
- Disabled by administrator
- Not in plan
- Planned

This separates business configuration from billing. Enabling a module does not falsely grant a plan feature, and assigning a plan feature does not force an irrelevant module into navigation.

## New-business defaults

New tenants receive safe recommendations from their selected business type. Only modules already implemented in production can be enabled automatically. Existing tenants receive all four currently implemented optional modules during migration so Phase 2 does not unexpectedly remove tools they were already using.

## Data safety and deployment

The migration adds one non-null PostgreSQL text-array field, `Shop.enabledModules`, with a compatibility default for existing tenants. No product, customer, order, payment, subscription, production, supplier or marketplace record is rewritten or deleted.
