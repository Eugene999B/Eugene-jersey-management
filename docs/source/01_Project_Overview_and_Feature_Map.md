# Sports Shop Platform - Project Overview and Feature Map

What was built from the uploaded roadmap and how the modules fit together.

## Purpose

This platform is a multi-tenant sports retail operations system for shop owners, staff, suppliers, customers, and a platform Super Admin. It combines catalog management, POS, credit sales, debts, custom jersey production, design studio tools, customer records, messaging, reporting, tenant branding, supplier purchasing, shop-to-shop networking, daily closing, exports, and audit logging in one Next.js application.

The app is built as a launch-ready SaaS foundation with extension points for production Paystack webhooks, SMS or WhatsApp providers, deeper cutter-machine integrations, offline POS, rentals, accounting, and mobile apps.

## Major Modules

- Super Admin: create shops, view usage, suspend or reactivate tenants, and broadcast announcements.
- Authentication: secure credential login, HTTP-only session cookie, password reset token flow, and account lockout after failed attempts.
- Role-Based Access Control: Owner, Manager, Cashier, Designer, Inventory Clerk, Accountant, Viewer, and Super Admin surfaces.
- Catalog: categories, attribute templates, products, variants, stock levels, personalization, service, and rental flags.
- POS: touch-friendly checkout, personalization capture, discounts, cash/card/mobile money payment methods, order creation, and stock decrement.
- Orders: button-driven production board with Pending, In Production, Ready, Completed, and Cancelled states.
- Reports: revenue, order count, average order, best sellers, stock report, staff performance, CSV export, and print-to-PDF.
- Debts: POS store-credit sales create customer debts and installment schedules automatically.
- Daily Closing: staff enter manual cash counts and compare them with system-expected cash, card, mobile money, and credit totals.
- Exports Center: POS, payment modes, debts, closing, catalog, suppliers, shop network, design jobs, messages, and activity logs export to PDF, Word, or Excel-compatible files.
- Design Studio: jersey artwork controls for garment style, layers, vinyl colors, heat press settings, cutter profiles, registration marks, weed boxes, mirrored HTV transfer mode, SVG export, JSON job export, and PLT cut-path export.
- Suppliers: supplier directory, supplier portal login, purchase orders, receiving workflow, stock increment on receipt, and lead-time tracking.
- Shop Network: each shop has a unique code for linking with trusted shops and requesting or exchanging stock.
- Payments: one platform Paystack secret can initialize transactions while each shop can store its own Paystack subaccount code and mobile money settlement details.
- Customer Tracking: public order status page at /track/[orderId] or /track/[receiptNumber].

## Technology Stack

- Next.js App Router with TypeScript for UI, server actions, API routes, and protected pages.
- PostgreSQL through Prisma ORM and the official Prisma PostgreSQL adapter.
- Tailwind CSS v4 for the interface system.
- bcryptjs for password hashing, jose for JWT session signing, and Zod for request validation.
- Recharts and lucide-react for analytics and iconography.

## Demo Scope

The included seed script creates a demo shop named Accra Pro Sports, a Super Admin, shop staff accounts, products, categories, variants, a customer, a production order, and an announcement.
