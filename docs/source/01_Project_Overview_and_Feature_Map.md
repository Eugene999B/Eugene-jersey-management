# Sports Shop Platform - Project Overview and Feature Map

What was built from the uploaded roadmap and how the modules fit together.

## Purpose

This platform is a multi-tenant sports retail operations system for shop owners, staff, and a platform Super Admin. It combines catalog management, POS, custom order production, customer records, reporting, tenant branding, and audit logging in one Next.js application.

The app is built as a launch-ready Phase 1 MVP with extension points for payments, SMS or WhatsApp, offline POS, rentals, supplier purchasing, accounting, and mobile apps.

## Major Modules

- Super Admin: create shops, view usage, suspend or reactivate tenants, and broadcast announcements.
- Authentication: secure credential login, HTTP-only session cookie, password reset token flow, and account lockout after failed attempts.
- Role-Based Access Control: Owner, Manager, Cashier, Designer, Inventory Clerk, Accountant, Viewer, and Super Admin surfaces.
- Catalog: categories, attribute templates, products, variants, stock levels, personalization, service, and rental flags.
- POS: touch-friendly checkout, personalization capture, discounts, cash/card/mobile money payment methods, order creation, and stock decrement.
- Orders: button-driven production board with Pending, In Production, Ready, Completed, and Cancelled states.
- Reports: revenue, order count, average order, best sellers, stock report, staff performance, CSV export, and print-to-PDF.
- Customer Tracking: public order status page at /track/[orderId] or /track/[receiptNumber].

## Technology Stack

- Next.js App Router with TypeScript for UI, server actions, API routes, and protected pages.
- PostgreSQL through Prisma ORM and the official Prisma PostgreSQL adapter.
- Tailwind CSS v4 for the interface system.
- bcryptjs for password hashing, jose for JWT session signing, and Zod for request validation.
- Recharts and lucide-react for analytics and iconography.

## Demo Scope

The included seed script creates a demo shop named Accra Pro Sports, a Super Admin, shop staff accounts, products, categories, variants, a customer, a production order, and an announcement.
