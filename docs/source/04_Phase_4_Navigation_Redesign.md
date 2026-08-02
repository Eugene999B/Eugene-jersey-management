# Phase 4 — Navigation redesign

## Release purpose

Phase 4 replaces long, duplicated navigation with a route-aware structure that remains useful on a small Android phone, a laptop and a large desktop. It builds on the Phase 3 design system and does not change business records, payments, stock, subscriptions or permissions.

## Shop mobile navigation

The permanent bottom bar contains the four universal operational destinations plus More:

- Home;
- Sell;
- Orders;
- Items;
- More.

Only destinations permitted for the signed-in role are rendered. The bottom bar reserves safe-area page space so forms and final actions are not hidden behind it.

The More drawer contains enabled and permitted tools grouped into:

- Customers & money;
- Operations;
- Management.

Printing, suppliers, online selling and marketplace entries continue to obey both module configuration and plan entitlements. Planned routes are not exposed before they exist.

## Shop desktop navigation

The desktop sidebar now:

- collapses from 260 pixels to an icon rail;
- remembers the user’s choice in local browser storage;
- groups tools consistently;
- strongly highlights the current route;
- shows recently used tools;
- keeps labels and accessible names when collapsed.

The top bar adds:

- breadcrumbs;
- a permission-aware global tool search, also opened with `/`;
- a Quick sale action for staff who can use POS;
- account, notification and security controls without duplicating the main navigation.

## Administrator navigation

Administrator tools are grouped by responsibility:

- Businesses;
- Plans & access;
- Billing;
- Support;
- Communications;
- Security;
- Platform settings.

The mobile administrator bar uses Home, Businesses, Billing, Support and More when those destinations are permitted. The top header no longer duplicates the More trigger.

## Verification

Permanent source tests verify the required labels, grouping, module filtering, collapse storage, breadcrumbs, tool search and safe bottom spacing. Chromium acceptance verifies desktop collapse/search/breadcrumb behavior, the exact mobile shop bar, grouped More drawers, administrator grouping and mobile navigation placement.

## Data safety

Phase 4 has no Prisma migration. It does not create, update or delete shops, customers, items, orders, payments, debts, subscription contracts, messages or production records. Existing route authorization, tenant isolation and module enforcement remain authoritative.
