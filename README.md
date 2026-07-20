# Eugene Jersey Management

Production-ready multi-tenant sports shop platform for jersey shops, sports equipment retailers, suppliers, buyers, and platform admins. The app is built with Next.js App Router, Prisma, PostgreSQL, role-based access, public storefronts, POS, debts, daily closing, supplier/network tools, exports, buyer ordering, chat, and an advanced jersey design studio.

Live Railway app: https://web-production-8ee56.up.railway.app

GitHub repository: https://github.com/Eugene999B/Eugene-jersey-management

## Core Stack

- Next.js 16 App Router and React 19
- Prisma 7 with PostgreSQL
- Railway for backend/database deployment
- Paystack-ready payment flow
- Arkesel-ready SMS/WhatsApp messaging helpers
- Server actions and API routes for secure mutations
- HTTP-only staff/admin and buyer sessions

## Main Areas

- `/login`: Staff, shop, supplier, and platform-admin gateway. Users enter a Login ID first. The system detects the account type and then asks for the correct password step.
- `/shops`: Public buyer marketplace. Buyers do not need staff IDs.
- `/shop/[slug]`: Public shop catalog with contact details, ordering, reviews, and chat entry.
- `/buyer/login`: Buyer phone/password login plus SMS setup/recovery.
- `/dashboard`: Shop operations dashboard.
- `/dashboard/designs`: Advanced jersey and transfer-sheet design studio.
- `/admin`: Super Admin platform command center.
- `/supplier`: Supplier portal.

## Login Rules

Buyers do not use staff IDs. They browse `/shops`, then sign in only when they want to buy, chat, rate, comment, or track orders.

Staff/admin/supplier users use `/login`:

1. Enter Login ID.
2. The system detects platform admin, admin worker, shop staff, shop workspace, or supplier.
3. User enters password.
4. Redirect is role-safe.

Shop staff can sign in with their own assigned worker Login ID, such as `APS-OWNER`, or through the shop workspace ID, such as `APS-STAFF`, followed by staff email and password.

Current seeded login IDs:

- Super Admin Login ID: `YPMS-ADMIN-ROOT`
- Super Admin email fallback: `super@ypms.test`
- Shop workspace ID: `APS-STAFF`
- Owner worker ID: `APS-OWNER`
- Manager worker ID: `APS-MANAGER`
- Cashier worker ID: `APS-CASHIER`
- Designer worker ID: `APS-DESIGNER`
- Accountant worker ID: `APS-ACCOUNTANT`
- Supplier Login ID: `APS-SUPPLIER`

Seeded password: `Ghana123`

The login page must not show any Super Admin code. Admin access is detected from assigned Login ID/email/phone and backend role checks.

## Admin System

The Super Admin area controls:

- Platform overview
- Tenant shops
- Admin staff/workers
- Buyer and marketplace health
- Supplier/network monitoring
- Payments and subscriptions
- Customer issue desk
- Messages/chats
- Activity logs
- Security guard
- Reports/settings

Important admin logic:

- A Super Admin cannot suspend himself.
- A Super Admin cannot update his own worker profile through the admin worker form.
- Admin worker permissions are stored in `User.adminPermissions`.
- Admin worker profile fields include `adminLoginId`, `staffTitle`, `department`, `emergencyContact`, and `staffNotes`.
- Failed staff login attempts are audited and temporarily locked after repeated failures.

## Buyer Flow

Buyers can:

- Browse all verified shops.
- Search by shop, location, category, sport, or product.
- View each shop's contact details.
- Sign in with phone/password.
- Use SMS setup/recovery.
- Chat with a shop only after signing in.
- Order for pickup or delivery.
- Pay online where enabled, or reserve cash pickup.
- Rate/review products only after login.

Online buying does not support credit. Credit is only approved inside shop/POS by shop staff.

## Design Studio

The design studio supports:

- Front, back, and production transfer-sheet views.
- Free movable text layers for name, number, sponsor, and crest.
- Drag selection by canvas hit-testing.
- Correct left/right movement in mirrored production view.
- Real zoom/pan and centered canvas layout.
- Text effects: flat, outline, shadow, arch, split, double outline, badge block.
- Insertable vector templates: lion, eagle, paw, football, basketball, trophy, crown, lightning, shield, circle, star, sash.
- Transfer sheet, material, cutter, heat press, and export manifest controls.

When editing this area, test selection carefully:

- Clicking blank jersey space must not move the player name.
- Clicking a text object should select that text object.
- Left/right controls must move visually left/right in production mirror mode.
- The jersey must remain centered and not clipped on desktop or mobile.

## Local Setup

```powershell
cd C:\Users\DDK\Documents\Jersey\sports-shop-platform-github-ready
npm.cmd install
copy .env.example .env
```

With Docker PostgreSQL:

```powershell
docker compose up -d
npm.cmd run setup:demo
npm.cmd run dev
```

Without Docker, use Prisma local Postgres:

```powershell
npx.cmd prisma dev --name sports-shop-platform --detach
npx.cmd prisma dev ls
# Copy the TCP DATABASE_URL into .env
npm.cmd run setup:demo
npm.cmd run dev
```

Open http://localhost:3000.

## Commands

```powershell
npm.cmd run db:generate
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd test
npm.cmd run build
npm.cmd run docs:generate
```

## Railway Deployment

Railway uses `railway.toml`:

- Build: `npx prisma generate && npm run build`
- Pre-deploy: `npx prisma migrate deploy && npm run db:seed`
- Start: `HOSTNAME=0.0.0.0 npm run start`

Do not connect this repository to the Chalin project. This repository deploys to the Railway project named `Eugene Jersey Management`.

## Important Files

- `prisma/schema.prisma`: Database model.
- `prisma/migrations`: Production migrations.
- `prisma/seed.ts`: Demo accounts, shop, supplier, buyer, products.
- `src/app/login/page.tsx`: Role-detect login UI.
- `src/app/api/auth/login/route.ts`: Staff/admin/supplier login backend.
- `src/app/buyer/login`: Buyer login and SMS recovery.
- `src/app/admin`: Super Admin command center and actions.
- `src/app/dashboard`: Shop dashboard.
- `src/components/design/design-studio.tsx`: Jersey design studio.
- `src/lib/auth.ts`: Staff/admin session helpers.
- `src/lib/buyer-session.ts`: Buyer session helpers.
- `src/lib/rbac.ts`: Role permissions.
- `src/lib/audit.ts`: Activity logging.

## AI Handoff Notes

Before editing:

1. Run `git status --short`.
2. Do not touch unrelated user changes.
3. Keep Chalin projects separate.
4. Preserve role-safe redirects and tenant isolation.
5. Run lint, TypeScript, tests, and build before pushing.
6. If changing the database, add a Prisma migration and update seed data if demo access depends on it.
7. If changing design studio behavior, test selection, movement, mirror view, zoom, and mobile layout.

Generated Word docs live in `docs/word` when `npm.cmd run docs:generate` is run.
