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
          "This platform is a multi-tenant sports retail operations system for shop owners, staff, and a platform Super Admin. It combines catalog management, POS, custom order production, customer records, reporting, tenant branding, and audit logging in one Next.js application.",
          "The app is built as a launch-ready Phase 1 MVP with extension points for payments, SMS or WhatsApp, offline POS, rentals, supplier purchasing, accounting, and mobile apps.",
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
          "cd C:\\Users\\DDK\\Documents\\Jersey\\sports-shop-platform",
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
          "All seeded demo users use the password ChangeMe123!. Change every password before real use.",
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
        ],
      },
      {
        heading: "First Run Checklist",
        bullets: [
          "Sign in as super@ypms.test and confirm the shop list appears.",
          "Sign out, then sign in as owner@accra.test.",
          "Open Catalog and create a test product.",
          "Open POS, add a product to the cart, choose Cash, and complete the sale.",
          "Open Orders and move the demo order through the production board.",
          "Open Reports and export CSV or use the PDF print button.",
          "Open /track/APS-10001 to see the public tracking page.",
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
        ],
      },
      {
        heading: "Create a Shop",
        bullets: [
          "Go to /admin/shops/new.",
          "Enter shop name, slug, first owner name, owner email, and plan tier.",
          "The app creates the shop and owner in one transaction.",
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
          "Complete sale creates an order, payment, order items, audit log, and decrements stock.",
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
          "For the simplest production path, deploy the Next.js app on Vercel and use a managed PostgreSQL provider such as Supabase or Neon. This matches the roadmap, keeps deployment simple, and avoids managing servers at launch.",
          "For a larger team or strict infrastructure control, deploy the same app to AWS, Azure, GCP, or a container platform, but that increases operational work.",
        ],
      },
      {
        heading: "Why Vercel Plus Managed Postgres",
        bullets: [
          "Vercel is built for Next.js application deployment and environment variable management.",
          "Managed Postgres providers handle backups, connection strings, metrics, and scaling knobs.",
          "Supabase provides connection pooling through Supavisor, which is useful for serverless environments.",
          "Neon provides Prisma guidance and serverless Postgres workflows.",
        ],
      },
      {
        heading: "Production Environment Variables",
        bullets: [
          "DATABASE_URL: production PostgreSQL connection string.",
          "SESSION_SECRET: long random secret, never reused from development.",
          "APP_URL: production URL.",
          "PAYSTACK_SECRET_KEY and PAYSTACK_PUBLIC_KEY: set when payment provider is ready.",
          "NOTIFICATION_PROVIDER: console, twilio, africastalking, or another provider once implemented.",
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
          "Create the production PostgreSQL database.",
          "Set environment variables in the hosting platform.",
          "Run migrations through CI/CD.",
          "Deploy the app.",
          "Create the first Super Admin with a secure password if not using demo seed data.",
          "Run smoke tests for login, catalog, POS, orders, reports, and tracking.",
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
          "InviteToken and PasswordResetToken for onboarding and recovery.",
          "Announcement, AnnouncementDismissal, Notification, SaleHold, ShopPaymentConfig, and AuditLog.",
        ],
      },
      {
        heading: "API Routes",
        bullets: [
          "POST /api/pos/checkout: validates cart, creates order, payment, order items, audit log, and decrements stock.",
          "PATCH /api/orders/[orderId]/status: updates production status with role restrictions.",
          "GET /api/receipts/[orderId]: returns printable receipt HTML.",
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
          "Payment provider webhooks for Paystack or MTN MoMo confirmation.",
          "Twilio or Africa's Talking notification provider inside a sendNotification service.",
          "Offline POS queue with local storage and conflict-safe sync.",
          "Supplier purchase orders and inventory transfers.",
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
          "Sports Shop Platform is a full-stack multi-tenant sports retail SaaS application. It was built from the YPMS roadmap document as a Phase 1 MVP covering tenant administration, staff login, RBAC, catalog, POS, custom production orders, customers, reports, branding, audit logs, and generated documentation.",
          "The project is not a separated frontend/backend architecture yet. It is a Next.js App Router application where the user interface, backend API routes, server actions, authentication, database access, and public tracking pages live in the same app. This matters for deployment decisions.",
        ],
      },
      {
        heading: "Current Project Location",
        bullets: [
          "Local path: C:\\Users\\DDK\\Documents\\Jersey\\sports-shop-platform",
          "Primary app framework: Next.js 16 App Router with TypeScript.",
          "Database: PostgreSQL through Prisma ORM v7 and @prisma/adapter-pg.",
          "Styling: Tailwind CSS v4 with custom global UI classes.",
          "Generated docs: docs/word and docs/source.",
          "Railway config: railway.toml.",
          "Prisma schema: prisma/schema.prisma.",
          "Initial production migration: prisma/migrations/20260714163000_init/migration.sql.",
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
          "Orders module with production board and role-limited status changes.",
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
          "src/app/api/orders/[orderId]/status/route.ts: production status updates and role enforcement.",
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
          "Password for all seeded accounts: ChangeMe123!",
          "super@ypms.test: Super Admin, opens /admin.",
          "owner@accra.test: Owner, full shop workspace.",
          "manager@accra.test: Manager.",
          "cashier@accra.test: POS and order operations.",
          "designer@accra.test: production order workflow.",
          "accountant@accra.test: reports and financial visibility.",
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
          "Step 1: Push sports-shop-platform to a private GitHub repository.",
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
          "Create a new empty GitHub repository. Do not initialize it with README, license, or gitignore because the project already has those files. Then run the following from the sports-shop-platform folder.",
        ],
        code: [
          "cd C:\\Users\\DDK\\Documents\\Jersey\\sports-shop-platform",
          "git init",
          "git add .",
          "git commit -m \"Initial Sports Shop Platform build\"",
          "git branch -M main",
          "git remote add origin https://github.com/YOUR-USERNAME/sports-shop-platform.git",
          "git push -u origin main",
        ],
      },
      {
        heading: "Railway Deployment Instructions",
        bullets: [
          "In Railway, create a new project and choose Deploy from GitHub repo.",
          "Select the sports-shop-platform repository.",
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
        ],
      },
      {
        heading: "Near-Term Development Backlog",
        bullets: [
          "Create production Super Admin setup command and remove dependency on demo seed users.",
          "Add real Paystack webhook confirmation and refund handling.",
          "Add SMS/WhatsApp provider implementation for Twilio or Africa's Talking.",
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
