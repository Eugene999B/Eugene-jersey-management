import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

type Section = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  code?: string[];
};

type DocSpec = {
  fileName: string;
  title: string;
  subtitle: string;
  sections: Section[];
};

const root = process.cwd();
const wordDir = path.join(root, "docs", "word");
const sourceDir = path.join(root, "docs", "source");

const docs: DocSpec[] = [
  {
    fileName: "01_Project_Overview_and_Feature_Map.docx",
    title: "Sports Shop Platform - Project Overview and Feature Map",
    subtitle: "What was built from the uploaded roadmap and how the modules fit together.",
    sections: [
      {
        heading: "Purpose",
        paragraphs: [
          "This platform is a multi-tenant sports retail operations system for shop owners, staff, suppliers, customers, and a platform Super Admin. It combines catalog management, POS, credit sales, debts, custom jersey production, design studio tools, customer records, messaging, reporting, tenant branding, supplier purchasing, shop-to-shop networking, daily closing, exports, and audit logging in one Next.js application.",
          "The app is built as a launch-ready SaaS foundation with extension points for production Paystack webhooks, SMS or WhatsApp providers, deeper cutter-machine integrations, offline POS, rentals, accounting, and mobile apps.",
        ],
      },
      {
        heading: "Major Modules",
        bullets: [
          "Super Admin: create shops, view usage, suspend or reactivate tenants, and broadcast announcements.",
          "Authentication: secure credential login, HTTP-only session cookie, password reset token flow, and account lockout after failed attempts.",
          "Role-Based Access Control: Owner, Manager, Cashier, Designer, Inventory Clerk, Accountant, Viewer, and Super Admin surfaces.",
          "Catalog: categories, attribute templates, products, variants, stock levels, personalization, service, and rental flags.",
          "POS: touch-friendly checkout, personalization capture, discounts, cash/card/mobile money payment methods, order creation, and stock decrement.",
          "Orders: button-driven production board with Pending, In Production, Ready, Completed, and Cancelled states.",
          "Reports: revenue, order count, average order, best sellers, stock report, staff performance, CSV export, and print-to-PDF.",
          "Debts: POS store-credit sales create customer debts and installment schedules automatically.",
          "Daily Closing: staff enter manual cash counts and compare them with system-expected cash, card, mobile money, and credit totals.",
          "Exports Center: POS, payment modes, debts, closing, catalog, suppliers, shop network, design jobs, messages, and activity logs export to PDF, Word, or Excel-compatible files.",
          "Design Studio: jersey artwork controls for garment style, layers, vinyl colors, heat press settings, cutter profiles, registration marks, weed boxes, mirrored HTV transfer mode, SVG export, JSON job export, and PLT cut-path export.",
          "Suppliers: supplier directory, supplier portal login, purchase orders, receiving workflow, stock increment on receipt, and lead-time tracking.",
          "Shop Network: each shop has a unique code for linking with trusted shops and requesting or exchanging stock.",
          "Payments: one platform Paystack secret can initialize transactions while each shop can store its own Paystack subaccount code and mobile money settlement details.",
          "Customer Tracking: public order status page at /track/[orderId] or /track/[receiptNumber].",
        ],
      },
      {
        heading: "Technology Stack",
        bullets: [
          "Next.js App Router with TypeScript for UI, server actions, API routes, and protected pages.",
          "PostgreSQL through Prisma ORM and the official Prisma PostgreSQL adapter.",
          "Tailwind CSS v4 for the interface system.",
          "bcryptjs for password hashing, jose for JWT session signing, and Zod for request validation.",
          "Recharts and lucide-react for analytics and iconography.",
        ],
      },
      {
        heading: "Demo Scope",
        paragraphs: [
          "The included seed script creates a demo shop named Accra Pro Sports, a Super Admin, shop staff accounts, products, categories, variants, a customer, a production order, and an announcement.",
        ],
      },
    ],
  },
  {
    fileName: "02_Local_Setup_Guide.docx",
    title: "Sports Shop Platform - Local Setup Guide",
    subtitle: "How to install and run the project on this computer or another developer device.",
    sections: [
      {
        heading: "Prerequisites",
        bullets: [
          "Node.js 24 or a compatible modern Node version.",
          "npm, which is already used by this project. On Windows PowerShell, use npm.cmd if npm.ps1 is blocked.",
          "PostgreSQL. The repository includes docker-compose.yml for a local Postgres container.",
          "Git for version control.",
        ],
      },
      {
        heading: "Install Dependencies",
        code: [
          "cd C:\\Users\\DDK\\Documents\\Jersey\\sports-shop-platform-github-ready",
          "npm.cmd install",
        ],
      },
      {
        heading: "Environment Setup",
        paragraphs: [
          "Copy .env.example to .env on the target device and change SESSION_SECRET before any real use. The default DATABASE_URL matches the docker-compose service.",
        ],
        code: [
          "copy .env.example .env",
          "notepad .env",
        ],
      },
      {
        heading: "Start Local Database",
        paragraphs: [
          "If Docker is installed, start PostgreSQL with the included compose file. If Docker is not installed, create a normal PostgreSQL database and put its connection string in DATABASE_URL.",
        ],
        code: [
          "docker compose up -d",
        ],
      },
      {
        heading: "No Docker Fallback",
        paragraphs: [
          "This machine did not have Docker installed, so the app was tested with Prisma's local Postgres helper instead. Start it in detached mode, list the server, then copy the TCP connection string into .env as DATABASE_URL.",
        ],
        code: [
          "npx.cmd prisma dev --name sports-shop-platform --detach",
          "npx.cmd prisma dev ls",
          "notepad .env",
        ],
      },
      {
        heading: "Create Tables and Demo Data",
        code: [
          "npm.cmd run setup:demo",
        ],
      },
      {
        heading: "Run the App",
        code: [
          "npm.cmd run dev",
          "Open http://localhost:3000",
        ],
      },
      {
        heading: "Validation Commands",
        code: [
          "npm.cmd run lint",
          "npm.cmd run test",
          "npm.cmd run build",
        ],
      },
    ],
  },
  {
    fileName: "03_Demo_Accounts_and_First_Run.docx",
    title: "Sports Shop Platform - Demo Accounts and First Run",
    subtitle: "Login details and the first workflows to test after seeding.",
    sections: [
      {
        heading: "Demo Password",
        paragraphs: [
          "All seeded demo users use the password Ghana123. Change every password before real use.",
        ],
      },
      {
        heading: "Accounts",
        bullets: [
          "super@ypms.test - Super Admin - opens /admin",
          "owner@accra.test - Owner - full shop operations",
          "manager@accra.test - Manager - most shop operations",
          "cashier@accra.test - Cashier - POS and orders",
          "designer@accra.test - Designer - production order status workflow",
          "accountant@accra.test - Accountant - reports and financial visibility",
          "supplier@accra.test - Supplier portal - purchase order acknowledgement",
        ],
      },
      {
        heading: "First Run Checklist",
        bullets: [
          "Sign in as super@ypms.test and confirm the shop list appears.",
          "Sign out, then sign in as owner@accra.test.",
          "Open Catalog and create a test product.",
          "Open POS, add a product to the cart, choose Cash, and complete the sale.",
          "Open POS again, choose Store Credit, enter a customer name, due date, and installment count, then confirm the debt appears in Debts.",
          "Open Orders and move the demo order through the production board.",
          "Open Designs and test the production view, cutter profile, heat press preset, SVG export, job JSON export, and PLT export.",
          "Open Suppliers, review the seeded supplier, create a purchase order, and receive it to increase stock.",
          "Open Daily Closing, enter counted cash, and export the closing report.",
          "Open Exports and download PDF, Word, and Excel-compatible reports.",
          "Open /track/APS-10001 to see the public tracking page.",
          "Sign in as supplier@accra.test and confirm /supplier shows purchase orders.",
        ],
      },
      {
        heading: "Common Local Issues",
        bullets: [
          "If login fails with a database error, confirm PostgreSQL is running and DATABASE_URL is correct.",
          "If npm is blocked in PowerShell, run npm.cmd instead.",
          "If Docker is not installed, use npx.cmd prisma dev ls and copy the TCP database URL into .env.",
          "If Prisma fails after changing the schema, run npm.cmd run db:generate.",
        ],
      },
    ],
  },
  {
    fileName: "04_Admin_Operations_Manual.docx",
    title: "Sports Shop Platform - Admin Operations Manual",
    subtitle: "How the platform owner manages tenants and global operations.",
    sections: [
      {
        heading: "Super Admin Dashboard",
        paragraphs: [
          "The /admin dashboard lists every shop with plan tier, status, user count, product count, order count, and creation date. Use it to monitor adoption and operational health across tenants.",
          "The dashboard also estimates monthly recurring revenue, shows open debt, recent platform activity, subscription state, and tenant usage signals.",
        ],
      },
      {
        heading: "Create a Shop",
        bullets: [
          "Go to /admin/shops/new.",
          "Enter shop name, slug, first owner name, owner email, and plan tier.",
          "The app creates the shop and owner in one transaction.",
          "The app also creates a unique shop network code and an empty payment configuration record for the tenant.",
          "The generated initial password is printed in the server console for development.",
        ],
      },
      {
        heading: "Suspend or Reactivate",
        paragraphs: [
          "Use Suspend to set Shop.isActive to false. Staff can still authenticate, but they will see the Shop Suspended screen instead of the dashboard. Reactivate restores access.",
        ],
      },
      {
        heading: "Broadcast Announcements",
        paragraphs: [
          "Use the Broadcast form on /admin to create a global announcement. It appears in shop dashboards until dismissed per user. The current implementation stores the announcement and supports dismissal extension through AnnouncementDismissal.",
        ],
      },
      {
        heading: "Plans, Renewals, and Payment Routing",
        bullets: [
          "Use Subscription update to change plan tier, monthly or yearly billing, pricing, renewal date, and subscription status.",
          "Use each shop's detail page to inspect renewal status, supplier count, debt records, closing count, Paystack subaccount status, and mobile money settlement details.",
          "The platform uses the server PAYSTACK_SECRET_KEY. Shops store their own Paystack subaccount code and mobile money details from Settings.",
          "Before real money collection, create or verify the shop's Paystack subaccount in Paystack and paste the subaccount code into the shop settings page.",
        ],
      },
      {
        heading: "Audit Trail",
        paragraphs: [
          "Admin actions write AuditLog records with the affected shop where applicable. Shop detail pages show recent audit activity.",
        ],
      },
    ],
  },
  {
    fileName: "05_Staff_Operations_Manual.docx",
    title: "Sports Shop Platform - Staff Operations Manual",
    subtitle: "How shop teams use catalog, POS, orders, customers, reports, staff, and settings.",
    sections: [
      {
        heading: "Dashboard",
        bullets: [
          "Review today's sales, pending orders, product count, active staff, low stock, and recent orders.",
          "Use the search area and navigation to move between modules.",
          "Branding is loaded from the shop record and applied as CSS variables.",
        ],
      },
      {
        heading: "Catalog",
        bullets: [
          "Create categories and optionally tie them to attribute templates.",
          "Create products with brand, condition, base price, stock, low-stock threshold, and flags for personalization, service, or rental.",
          "Variants are tracked with unique SKUs and stock quantities.",
          "Catalog write access is restricted to Owner, Manager, and Inventory Clerk roles.",
        ],
      },
      {
        heading: "POS",
        bullets: [
          "Search or filter products by category.",
          "Tap a product to add it to the cart.",
          "If the product is personalizable, enter name, number, and production notes.",
          "Choose Cash, Card, or MoMo. Card and MoMo are sandbox/stubbed until provider keys are configured.",
          "Choose Store Credit when a customer is buying now and paying later. The checkout requires a customer name and can split the debt into installments.",
          "Complete sale creates an order, payment, order items, audit log, and decrements stock.",
          "Credit sales create a pending payment record plus a Debt record with installment due dates.",
        ],
      },
      {
        heading: "Orders",
        bullets: [
          "Orders are grouped by Pending, In Production, Ready, Completed, and Cancelled.",
          "Designers can only move Pending to In Production and In Production to Ready.",
          "Owners and Managers can complete, cancel, or move orders more broadly.",
          "Every status change writes an audit log and in-app notification record.",
        ],
      },
      {
        heading: "Reports",
        bullets: [
          "Filter by today, last 7 days, last 30 days, or last year.",
          "Review revenue, order count, average order, best sellers, stock levels, and staff performance.",
          "Export CSV or print the report to PDF.",
        ],
      },
      {
        heading: "Debts and Installments",
        bullets: [
          "Open Debts to review store-credit balances, installment schedules, due dates, reminder counts, and payment status.",
          "Use the messaging tools to send SMS or WhatsApp reminders once a production provider is configured.",
          "Debt reports can be exported from the Exports center as PDF, Word, or Excel-compatible files.",
        ],
      },
      {
        heading: "Daily Closing",
        bullets: [
          "Open Daily Closing at the end of the day.",
          "Select the business date, enter opening float, counted cash, expenses, refunds, and notes.",
          "The system compares manual cash against expected cash and stores a Balanced or Variance result.",
          "Closing history can be exported to PDF, Word, or Excel-compatible files.",
        ],
      },
      {
        heading: "Design Studio",
        bullets: [
          "Open Designs to create front, back, or production artwork for jerseys.",
          "Use garment styles, layer toggles, color controls, material presets, heat press settings, cutter profiles, blade offset, overcut, force, speed, mirror mode, registration marks, and weed boxes.",
          "Export SVG for artwork, JSON for job settings, or PLT as a starting cut-path file for cutter workflows.",
          "Exact direct machine control still depends on the shop's cutter model, driver, and connection protocol.",
        ],
      },
      {
        heading: "Suppliers and Shop Network",
        bullets: [
          "Open Suppliers to create suppliers, assign supplier portal logins, create purchase orders, and receive stock.",
          "Supplier users sign in and open /supplier to acknowledge purchase orders.",
          "Open Shop Network to share your unique shop code, link with trusted shops, and request items from partners.",
          "Network fulfillment decrements the supplier shop's linked stock after checking availability.",
        ],
      },
      {
        heading: "Exports Center",
        bullets: [
          "Open Exports to download POS, payment modes, debts, daily closing, catalog, suppliers, shop network, design jobs, messages, and activity logs.",
          "Each export supports PDF, Word, or Excel-compatible output.",
        ],
      },
    ],
  },
  {
    fileName: "06_Deployment_Guide.docx",
    title: "Sports Shop Platform - Deployment Guide",
    subtitle: "Recommended deployment path, environment variables, and production migration notes.",
    sections: [
      {
        heading: "Recommended Hosting",
        paragraphs: [
          "For the current codebase, deploy the full Next.js app and PostgreSQL database together on Railway. This app is not split into a separate static frontend and backend API; server actions, API routes, authentication, and Prisma database access live inside the Next.js app.",
          "Cloudflare should be used first as DNS, SSL, proxy, CDN, and WAF in front of the Railway app. A separate Cloudflare frontend can come later only after the backend is refactored into a standalone API.",
        ],
      },
      {
        heading: "Why Railway First",
        bullets: [
          "Railway can host the Next.js service and PostgreSQL database in the same project.",
          "railway.toml already defines the build command, pre-deploy migration command, start command, healthcheck path, and restart policy.",
          "Keeping the app and database together reduces launch risk while the product is still moving fast.",
          "Cloudflare can still protect the public domain without splitting the codebase.",
        ],
      },
      {
        heading: "Production Environment Variables",
        bullets: [
          "DATABASE_URL: production PostgreSQL connection string.",
          "SESSION_SECRET: long random secret, never reused from development.",
          "APP_URL: production URL.",
          "PAYSTACK_SECRET_KEY: platform secret key used server-side to initialize payments.",
          "PAYSTACK_PUBLIC_KEY: public key used where a client-side Paystack flow is added.",
          "Per-shop Paystack subaccount codes: stored in each shop's Settings page, not as global environment variables.",
          "NOTIFICATION_PROVIDER: console, twilio, africastalking, or another provider once implemented.",
        ],
      },
      {
        heading: "Paystack Settlement Plan",
        bullets: [
          "Create or verify a Paystack subaccount for each shop that should receive online payments.",
          "Paste the shop's subaccount code into Dashboard > Settings > Payments.",
          "Set the platform transaction charge in pesewas if the platform keeps a fixed service fee from each transaction.",
          "Choose the Paystack charge bearer value in settings: subaccount, account, all, or all-proportional.",
          "Keep PAYSTACK_SECRET_KEY only in Railway variables. Do not store a secret key in the database or frontend.",
        ],
      },
      {
        heading: "Production Database Migrations",
        paragraphs: [
          "Use prisma migrate deploy in CI/CD or the deployment pipeline for production migrations. Do not use prisma db push against production because it bypasses migration history.",
        ],
        code: [
          "npx prisma migrate deploy",
        ],
      },
      {
        heading: "Official References Checked",
        bullets: [
          "Vercel environment variables: https://vercel.com/docs/environment-variables",
          "Next.js environment variables: https://nextjs.org/docs/app/guides/environment-variables",
          "Prisma production migrations: https://www.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate",
          "Supabase Postgres connections: https://supabase.com/docs/guides/database/connecting-to-postgres",
          "Neon Prisma guide: https://neon.com/docs/guides/prisma",
        ],
      },
      {
        heading: "Deployment Checklist",
        bullets: [
          "Commit code and push to GitHub.",
          "Create a Railway project from the GitHub repository.",
          "Add a Railway PostgreSQL database to the same project.",
          "Set DATABASE_URL, SESSION_SECRET, APP_URL, PAYSTACK_SECRET_KEY, and notification variables in Railway.",
          "Confirm railway.toml is detected and lets Railway run prisma migrate deploy before start.",
          "Deploy the app from GitHub.",
          "Point a Cloudflare-managed domain to the Railway service when the Railway URL is stable.",
          "Create the first Super Admin with a secure password if not using demo seed data.",
          "Run smoke tests for login, catalog, POS, credit sale, debts, daily closing, suppliers, design studio, exports, public ordering, and tracking.",
        ],
      },
    ],
  },
  {
    fileName: "07_Security_and_Compliance_Runbook.docx",
    title: "Sports Shop Platform - Security and Compliance Runbook",
    subtitle: "Controls already implemented and production hardening tasks.",
    sections: [
      {
        heading: "Implemented Controls",
        bullets: [
          "bcrypt password hashing with cost factor 12.",
          "HTTP-only, same-site session cookie signed with jose.",
          "Protected admin and dashboard routes through Next proxy.",
          "Role checks in page actions and API routes.",
          "Tenant-scoped queries using session.shopId.",
          "Account lockout after 5 failed login attempts within a 15 minute window.",
          "Zod validation on server actions and API payloads.",
          "Security headers: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy.",
          "AuditLog records for login, admin, staff, catalog, POS, settings, and order changes.",
        ],
      },
      {
        heading: "Production Must-Do",
        bullets: [
          "Replace development SESSION_SECRET with a long random secret.",
          "Remove demo passwords and seed users before real launch.",
          "Use HTTPS everywhere.",
          "Enable database backups and point-in-time recovery.",
          "Store payment and notification secrets in the hosting provider, not in source code.",
          "Add 2FA before onboarding high-value tenants.",
          "Add rate limiting to login, reset password, checkout, and public tracking routes.",
          "Add centralized logging and alerting.",
        ],
      },
      {
        heading: "Data Protection",
        bullets: [
          "Keep each tenant's data scoped by shopId.",
          "Use exports and deletion workflows when a customer requests their data.",
          "Minimize stored payment data. Use provider references instead of card details.",
          "Restrict financial reporting to Owner, Manager, and Accountant roles.",
        ],
      },
      {
        heading: "Incident Response",
        bullets: [
          "Suspend affected shop if tenant compromise is suspected.",
          "Rotate SESSION_SECRET to invalidate sessions if session signing key exposure is suspected.",
          "Rotate payment and SMS provider API keys from provider dashboards.",
          "Review AuditLog for suspicious actions.",
          "Restore from backup only after validating the recovery point.",
        ],
      },
    ],
  },
  {
    fileName: "08_Database_API_and_Maintenance_Reference.docx",
    title: "Sports Shop Platform - Database, API, and Maintenance Reference",
    subtitle: "Schema summary, API routes, maintenance commands, and extension points.",
    sections: [
      {
        heading: "Core Models",
        bullets: [
          "Shop, User, Category, AttributeTemplate, AttributeField.",
          "Product and ProductVariant for flexible sports catalog data.",
          "Customer, Order, OrderItem, and Payment for sales workflows.",
          "Debt and DebtInstallment for credit sales and structured repayments.",
          "DailyClosing for end-of-day manual cash count, expected totals, and variance tracking.",
          "Supplier, SupplierOrder, and SupplierOrderItem for supplier portal, purchase orders, and stock receiving.",
          "ShopNetworkLink, ShopNetworkOrder, and ShopNetworkOrderItem for trusted shop-to-shop requests and exchanges.",
          "CustomerThread, CustomerChatMessage, CustomerMessage, and DesignJob for customer communication and production workflows.",
          "InviteToken and PasswordResetToken for onboarding and recovery.",
          "Announcement, AnnouncementDismissal, Notification, SaleHold, ShopPaymentConfig, and AuditLog.",
        ],
      },
      {
        heading: "API Routes",
        bullets: [
          "POST /api/pos/checkout: validates cart, creates order, payment, order items, audit log, and decrements stock.",
          "POST /api/pos/checkout with STORE_CREDIT: creates a pending payment plus Debt and DebtInstallment records.",
          "PATCH /api/orders/[orderId]/status: updates production status with role restrictions.",
          "GET /api/receipts/[orderId]: returns printable receipt HTML.",
          "POST /api/public-order: creates public shop orders and initializes Paystack payments with optional shop subaccount routing.",
          "GET /api/exports: returns protected PDF, Word, or Excel-compatible exports by module.",
        ],
      },
      {
        heading: "Maintenance Commands",
        code: [
          "npm.cmd run db:generate",
          "npm.cmd run db:migrate",
          "npm.cmd run db:seed",
          "npm.cmd run lint",
          "npm.cmd run test",
          "npm.cmd run build",
          "npm.cmd run docs:generate",
        ],
      },
      {
        heading: "Next Extension Points",
        bullets: [
          "Payment provider webhooks for Paystack or MTN MoMo confirmation, refunds, and reconciliation.",
          "Twilio, Africa's Talking, or WhatsApp Business provider implementation inside the messaging service.",
          "Offline POS queue with local storage and conflict-safe sync.",
          "Direct cutter or plotter driver bridges for exact machine models.",
          "Service bookings and rental scheduling calendars.",
          "CSV import mapping for bulk catalog upload.",
        ],
      },
      {
        heading: "Backup Notes",
        bullets: [
          "Use managed Postgres automated backups in production.",
          "Test restore to a staging database regularly.",
          "Export CSV reports for business records, but do not treat CSV as a full backup.",
        ],
      },
    ],
  },
  {
    fileName: "09_ChatGPT_Project_Handoff_and_Deployment_Playbook.docx",
    title: "Sports Shop Platform - ChatGPT Project Handoff and Deployment Playbook",
    subtitle: "A wide context document for ChatGPT, another AI coding agent, or a developer joining the project.",
    sections: [
      {
        heading: "Executive Summary",
        paragraphs: [
          "Sports Shop Platform is a full-stack multi-tenant sports retail SaaS application. It was built from the YPMS roadmap document and expanded into a professional jersey-shop platform covering tenant administration, staff login, RBAC, catalog, POS, credit sales, debts, custom production orders, design studio, customer messaging, supplier purchasing, shop networking, daily closing, exports, reports, branding, audit logs, and generated documentation.",
          "The project is not a separated frontend/backend architecture yet. It is a Next.js App Router application where the user interface, backend API routes, server actions, authentication, database access, and public tracking pages live in the same app. This matters for deployment decisions.",
        ],
      },
      {
        heading: "Current Project Location",
        bullets: [
          "Local path: C:\\Users\\DDK\\Documents\\Jersey\\sports-shop-platform-github-ready",
          "Primary app framework: Next.js 16 App Router with TypeScript.",
          "Database: PostgreSQL through Prisma ORM v7 and @prisma/adapter-pg.",
          "Styling: Tailwind CSS v4 with custom global UI classes.",
          "Generated docs: docs/word and docs/source.",
          "Railway config: railway.toml.",
          "Prisma schema: prisma/schema.prisma.",
          "Initial production migration: prisma/migrations/20260714163000_init/migration.sql.",
          "Operations upgrade migration: prisma/migrations/20260719153000_ops_network_closing/migration.sql.",
        ],
      },
      {
        heading: "What Is Implemented",
        bullets: [
          "Landing page and login flow.",
          "HTTP-only JWT session cookie signed with jose.",
          "bcrypt password hashes and account lockout after failed attempts.",
          "Super Admin panel at /admin for shops, suspension/reactivation, tenant detail, usage, and announcements.",
          "Tenant dashboard at /dashboard with KPIs, low stock, recent orders, and branded shell.",
          "Catalog module with categories, templates, products, variants, stock quantities, low-stock thresholds, and personalization/service/rental flags.",
          "POS module with touch-friendly product grid, cart, discounts, personalization modal, payment method choice, stock decrement, order creation, and payment record.",
          "POS store-credit flow that creates debts and installment schedules automatically.",
          "Orders module with production board and role-limited status changes.",
          "Daily Closing module at /dashboard/closing with manual counted cash, expected system totals, variance status, history, and printable exports.",
          "Exports Center at /dashboard/exports for POS, payment modes, debts, daily closing, catalog, suppliers, shop network, design jobs, messages, and activity logs.",
          "Design Studio at /dashboard/designs with garment styles, layers, vinyl colors, heat press presets, cutter profiles, registration marks, weed boxes, mirrored HTV mode, SVG export, JSON job export, and PLT cut-path export.",
          "Supplier management at /dashboard/suppliers plus /supplier supplier portal login and purchase order acknowledgement.",
          "Shop Network at /dashboard/network with unique shop codes, trusted shop links, outgoing requests, incoming requests, and stock-checked fulfillment.",
          "Public shop ordering with Paystack initialization and per-shop subaccount routing fields.",
          "Public tracking page at /track/[orderId] or /track/[receiptNumber].",
          "Customers, reports, staff invites, shop settings, receipt HTML, notifications table, and audit logs.",
          "Seed data for Accra Pro Sports and demo users.",
        ],
      },
      {
        heading: "Important Files",
        bullets: [
          "src/lib/db.ts: shared Prisma client using PrismaPg adapter.",
          "src/lib/auth.ts and src/lib/session-token.ts: password helpers, sessions, cookies, and auth guards.",
          "src/lib/rbac.ts: role labels, permission groups, and navigation visibility.",
          "src/proxy.ts: route protection for /dashboard and /admin.",
          "src/app/api/pos/checkout/route.ts: server-side POS checkout and stock decrement.",
          "src/app/api/exports/route.ts: protected report export engine for PDF, Word, and Excel-compatible downloads.",
          "src/app/api/public-order/route.ts: public order creation and Paystack initialization with shop subaccount routing.",
          "src/app/api/orders/[orderId]/status/route.ts: production status updates and role enforcement.",
          "src/app/dashboard/closing/*: daily closing page and server action.",
          "src/app/dashboard/suppliers/* and src/app/supplier/*: supplier management and supplier portal.",
          "src/app/dashboard/network/*: shop-to-shop linking and transfer requests.",
          "src/components/design/design-studio.tsx: browser-side jersey production design surface.",
          "src/app/dashboard/*: tenant-facing modules.",
          "src/app/admin/*: platform Super Admin modules.",
          "prisma/seed.ts: demo data seed script.",
          "scripts/generate-docs.ts: generates the Word and markdown documentation pack.",
        ],
      },
      {
        heading: "Local Commands",
        code: [
          "npm.cmd install",
          "npm.cmd run setup:demo",
          "npm.cmd run dev",
          "npm.cmd run lint",
          "npm.cmd run test",
          "npm.cmd run build",
          "npm.cmd run docs:generate",
        ],
      },
      {
        heading: "Demo Accounts",
        bullets: [
          "Password for all seeded accounts: Ghana123",
          "super@ypms.test: Super Admin, opens /admin.",
          "owner@accra.test: Owner, full shop workspace.",
          "manager@accra.test: Manager.",
          "cashier@accra.test: POS and order operations.",
          "designer@accra.test: production order workflow.",
          "accountant@accra.test: reports and financial visibility.",
          "supplier@accra.test: supplier portal.",
        ],
      },
      {
        heading: "Deployment Answer: Railway Backend and Database, Cloudflare Frontend",
        paragraphs: [
          "The exact split of backend plus database on Railway and frontend on Cloudflare Pages is not the best fit for this codebase as it exists today. The backend is not a separate Express/Nest/FastAPI service; it is integrated into Next.js through route handlers and server actions. If only static frontend files are sent to Cloudflare Pages, login, dashboard data, POS checkout, reports, order updates, and receipts will break unless the backend is refactored into a separate API service and the frontend is changed to call that API.",
          "The recommended first production deployment is to deploy the full Next.js app and PostgreSQL database on Railway. Then optionally put Cloudflare in front as DNS, CDN, WAF, and custom domain proxy. This gives you Cloudflare benefits without prematurely splitting the app.",
          "A future split is possible. To do it properly, create a separate backend service on Railway, move Prisma/auth/API logic into that service, expose versioned REST or GraphQL endpoints, and convert the Next.js frontend to a mostly client/static Cloudflare app that consumes the Railway API.",
        ],
      },
      {
        heading: "Recommended Production Path",
        bullets: [
          "Step 1: Push sports-shop-platform-github-ready to a private GitHub repository.",
          "Step 2: Create a Railway project from that GitHub repository.",
          "Step 3: Add a Railway PostgreSQL database.",
          "Step 4: Add DATABASE_URL to the Next.js service as a reference variable from the Postgres service.",
          "Step 5: Set SESSION_SECRET, APP_URL, PAYSTACK keys, and notification provider variables.",
          "Step 6: Let railway.toml run build, pre-deploy migrations, start command, and healthcheck.",
          "Step 7: Generate a Railway public domain or connect a custom domain.",
          "Step 8: Use Cloudflare DNS/proxy for the custom domain if desired.",
        ],
      },
      {
        heading: "GitHub Push Instructions",
        paragraphs: [
          "Create a new empty GitHub repository. Do not initialize it with README, license, or gitignore because the project already has those files. Then run the following from the sports-shop-platform-github-ready folder.",
        ],
        code: [
          "cd C:\\Users\\DDK\\Documents\\Jersey\\sports-shop-platform-github-ready",
          "git init",
          "git add .",
          "git commit -m \"Initial Sports Shop Platform build\"",
          "git branch -M main",
          "git remote add origin https://github.com/YOUR-USERNAME/sports-shop-platform-github-ready.git",
          "git push -u origin main",
        ],
      },
      {
        heading: "Railway Deployment Instructions",
        bullets: [
          "In Railway, create a new project and choose Deploy from GitHub repo.",
          "Select the sports-shop-platform-github-ready repository.",
          "Add a PostgreSQL database service from Railway.",
          "In the Next.js service Variables tab, add DATABASE_URL as a reference to the Postgres service.",
          "Add SESSION_SECRET with a long random value. Never use the local dev value in production.",
          "Add APP_URL with the Railway or custom domain URL.",
          "Confirm railway.toml is detected. It sets buildCommand, preDeployCommand, startCommand, healthcheckPath, and restart policy.",
          "After first deploy, open /login and sign in with a real production Super Admin. Do not rely on demo seed users for production.",
        ],
      },
      {
        heading: "Cloudflare Options",
        bullets: [
          "Best near-term option: use Cloudflare DNS, proxy, SSL, caching rules, and WAF in front of the Railway app.",
          "Full Cloudflare app option: deploy the entire Next.js app to Cloudflare Workers using the OpenNext adapter. This requires Cloudflare-specific configuration and careful testing of Prisma/PostgreSQL connectivity through edge-compatible drivers or Hyperdrive.",
          "Static frontend option: only possible after refactoring the backend into a separate Railway API and changing the frontend to call that API.",
        ],
      },
      {
        heading: "Current Official References Used",
        bullets: [
          "Railway Next.js with Postgres guide: https://docs.railway.com/guides/nextjs",
          "Railway config as code reference: https://docs.railway.com/config-as-code/reference",
          "GitHub local repository push guide: https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github",
          "Cloudflare Workers Next.js guide: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/",
          "Cloudflare Pages Next.js guide: https://developers.cloudflare.com/pages/framework-guides/nextjs/",
          "Prisma Cloudflare deployment guide: https://www.prisma.io/docs/orm/prisma-client/deployment/edge/deploy-to-cloudflare",
          "Cloudflare Hyperdrive Prisma ORM example: https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/prisma-orm/",
        ],
      },
      {
        heading: "What To Ask ChatGPT Next",
        paragraphs: [
          "Paste the prompt below into ChatGPT together with this document or the repository link. It tells ChatGPT how to understand the project without guessing.",
        ],
        code: [
          "You are helping me continue a project named Sports Shop Platform.",
          "It is a full-stack Next.js 16 App Router + TypeScript + Prisma v7 + PostgreSQL multi-tenant sports retail SaaS.",
          "Read the repository first. Important files: prisma/schema.prisma, src/lib/db.ts, src/lib/auth.ts, src/lib/rbac.ts, src/proxy.ts, src/app/dashboard, src/app/admin, src/app/api, scripts/generate-docs.ts, railway.toml.",
          "Do not assume frontend and backend are separate. Server actions, route handlers, auth, and Prisma live inside the Next.js app.",
          "When changing database models, update prisma/schema.prisma and create a proper Prisma migration.",
          "Keep tenant isolation by always scoping tenant data with session.shopId.",
          "Keep role permissions consistent with src/lib/rbac.ts.",
          "Before finishing any change, run npm run lint, npm run test, npm run build, and npm audit --audit-level=moderate.",
          "My deployment target is Railway for the full-stack app and PostgreSQL first, with Cloudflare as DNS/proxy. Only split frontend to Cloudflare later if we refactor the backend into a separate API.",
          "Paystack uses one platform PAYSTACK_SECRET_KEY on the server. Each shop can store its own Paystack subaccount code and mobile money settlement details in Dashboard > Settings.",
          "The design studio provides SVG, JSON job, and PLT exports. Exact direct cutter control requires confirming the shop's cutter model, driver, and connection protocol before adding a machine bridge.",
        ],
      },
      {
        heading: "Near-Term Development Backlog",
        bullets: [
          "Create production Super Admin setup command and remove dependency on demo seed users.",
          "Add real Paystack webhook confirmation and refund handling.",
          "Add SMS/WhatsApp provider implementation for Twilio or Africa's Talking.",
          "Add automated Paystack subaccount onboarding for shops.",
          "Add direct integrations for the exact cutting plotter models used by target shops.",
          "Add CSV import mapping UI for catalog bulk uploads.",
          "Add customer account storefront or public shop pages.",
          "Add rate limiting on login, reset password, checkout, and tracking endpoints.",
          "Add 2FA for owner and admin roles.",
          "Add automated end-to-end tests for login, POS checkout, and order workflow.",
        ],
      },
    ],
  },
];

function paragraph(text: string) {
  return new Paragraph({
    spacing: { after: 160 },
    children: [new TextRun({ text, size: 22 })],
  });
}

function bullet(text: string) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 100 },
    children: [new TextRun({ text, size: 21 })],
  });
}

function codeLine(text: string) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text, font: "Consolas", size: 20 })],
  });
}

function sourceMarkdown(doc: DocSpec) {
  const parts = [`# ${doc.title}`, "", doc.subtitle, ""];
  for (const section of doc.sections) {
    parts.push(`## ${section.heading}`, "");
    if (section.paragraphs) parts.push(...section.paragraphs.flatMap((item) => [item, ""]));
    if (section.bullets) parts.push(...section.bullets.map((item) => `- ${item}`), "");
    if (section.code) parts.push("```powershell", ...section.code, "```", "");
  }
  return parts.join("\n");
}

async function buildDoc(doc: DocSpec) {
  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 220 },
      children: [new TextRun({ text: doc.title, bold: true, size: 34 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 360 },
      children: [new TextRun({ text: doc.subtitle, italics: true, size: 22 })],
    }),
  ];

  for (const section of doc.sections) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 160, after: 120 },
      children: [new TextRun({ text: section.heading, bold: true, size: 28 })],
    }));

    section.paragraphs?.forEach((item) => children.push(paragraph(item)));
    section.bullets?.forEach((item) => children.push(bullet(item)));
    section.code?.forEach((item) => children.push(codeLine(item)));
  }

  const document = new Document({
    creator: "Codex",
    title: doc.title,
    description: doc.subtitle,
    sections: [{ children }],
  });

  await writeFile(path.join(wordDir, doc.fileName), await Packer.toBuffer(document));
  await writeFile(path.join(sourceDir, doc.fileName.replace(".docx", ".md")), sourceMarkdown(doc));
}

async function main() {
  await mkdir(wordDir, { recursive: true });
  await mkdir(sourceDir, { recursive: true });

  for (const doc of docs) {
    await buildDoc(doc);
  }

  const index = [
    "# Sports Shop Platform Documentation Pack",
    "",
    "Generated files:",
    "",
    ...docs.map((doc, index) => `${index + 1}. docs/word/${doc.fileName}`),
    "",
    "Source markdown versions are in docs/source.",
    "",
  ].join("\n");

  await writeFile(path.join(root, "docs", "README.md"), index);
  console.log(`Generated ${docs.length} Word documents in ${wordDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
