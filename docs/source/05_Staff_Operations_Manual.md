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
- Choose Store Credit when a customer is buying now and paying later. The checkout requires a customer name and can split the debt into installments.
- Complete sale creates an order, payment, order items, audit log, and decrements stock.
- Credit sales create a pending payment record plus a Debt record with installment due dates.

## Orders

- Orders are grouped by Pending, In Production, Ready, Completed, and Cancelled.
- Designers can only move Pending to In Production and In Production to Ready.
- Owners and Managers can complete, cancel, or move orders more broadly.
- Every status change writes an audit log and in-app notification record.

## Reports

- Filter by today, last 7 days, last 30 days, or last year.
- Review revenue, order count, average order, best sellers, stock levels, and staff performance.
- Export CSV or print the report to PDF.

## Debts and Installments

- Open Debts to review store-credit balances, installment schedules, due dates, reminder counts, and payment status.
- Use the messaging tools to send SMS or WhatsApp reminders once a production provider is configured.
- Debt reports can be exported from the Exports center as PDF, Word, or Excel-compatible files.

## Daily Closing

- Open Daily Closing at the end of the day.
- Select the business date, enter opening float, counted cash, expenses, refunds, and notes.
- The system compares manual cash against expected cash and stores a Balanced or Variance result.
- Closing history can be exported to PDF, Word, or Excel-compatible files.

## Design Studio

- Open Designs to create front, back, or production artwork for jerseys.
- Use garment styles, layer toggles, color controls, material presets, heat press settings, cutter profiles, blade offset, overcut, force, speed, mirror mode, registration marks, and weed boxes.
- Export SVG for artwork, JSON for job settings, or PLT as a starting cut-path file for cutter workflows.
- Exact direct machine control still depends on the shop's cutter model, driver, and connection protocol.

## Suppliers and Shop Network

- Open Suppliers to create suppliers, assign supplier portal logins, create purchase orders, and receive stock.
- Supplier users sign in and open /supplier to acknowledge purchase orders.
- Open Shop Network to share your unique shop code, link with trusted shops, and request items from partners.
- Network fulfillment decrements the supplier shop's linked stock after checking availability.

## Exports Center

- Open Exports to download POS, payment modes, debts, daily closing, catalog, suppliers, shop network, design jobs, messages, and activity logs.
- Each export supports PDF, Word, or Excel-compatible output.
