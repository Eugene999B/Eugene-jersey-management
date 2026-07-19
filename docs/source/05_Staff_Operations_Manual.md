# Sports Shop Platform - Staff Operations Manual

How shop teams use catalog, POS, orders, customers, reports, staff, and settings.

## Dashboard

- Review today's sales, pending orders, product count, active staff, low stock, and recent orders.
- Use the search area and navigation to move between modules.
- Branding is loaded from the shop record and applied as CSS variables.

## Catalog

- Create categories and optionally tie them to attribute templates.
- Create products with brand, condition, base price, stock, low-stock threshold, and flags for personalization, service, or rental.
- Variants are tracked with unique SKUs and stock quantities.
- Catalog write access is restricted to Owner, Manager, and Inventory Clerk roles.

## POS

- Search or filter products by category.
- Tap a product to add it to the cart.
- If the product is personalizable, enter name, number, and production notes.
- Choose Cash, Card, or MoMo. Card and MoMo are sandbox/stubbed until provider keys are configured.
- Complete sale creates an order, payment, order items, audit log, and decrements stock.

## Orders

- Orders are grouped by Pending, In Production, Ready, Completed, and Cancelled.
- Designers can only move Pending to In Production and In Production to Ready.
- Owners and Managers can complete, cancel, or move orders more broadly.
- Every status change writes an audit log and in-app notification record.

## Reports

- Filter by today, last 7 days, last 30 days, or last year.
- Review revenue, order count, average order, best sellers, stock levels, and staff performance.
- Export CSV or print the report to PDF.
