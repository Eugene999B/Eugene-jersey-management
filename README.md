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

1. Enter Login ID or work email.
2. The system finds the assigned account without exposing account details.
3. User enters the account password.
4. Redirect is role-safe.

Shop staff can sign in with their personal worker Login ID or their work email. Supplier accounts use their assigned supplier Login ID or email.

Production Super Admin access is created from Railway `ADMIN_*` variables by the repository-controlled `production:activate` command. The default Login ID is `EJM-ADMIN-ROOT` when `ADMIN_LOGIN_ID` is not supplied.

Seeded demo identities are strictly for intentional local demo setup. Production deployment deactivates seeded demo staff, buyer, supplier, and shop access. Demo credentials must never be published or reused in production.

The login page must not show any Super Admin code. Admin access is detected from assigned Login ID/email and backend role checks.

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
- Users attached to a suspended shop are rejected during login.

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
- Undo, redo, delete selected, keyboard shortcuts, and safer click/drag selection on scaled jerseys.
- Grouped insertable vector templates for animals, sports marks, objects, Ghana/club starters, and badges.
- Insertable vector templates include lion, eagle, paw, wing, football, basketball, volleyball, tennis, boxing, boot, trophy, crown, lightning, flame, shield, circle, star, and sash.
- Transfer sheet, material, cutter, heat press, device test/send, device status, and export manifest controls.

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
npm.cmd run admin:bootstrap
npm.cmd run production:activate
```

## Railway Deployment

Railway uses `railway.toml`:

- Build: `npx prisma generate && npm run build`
- Pre-deploy: `npx prisma migrate deploy && npm run production:activate`
- Start: `HOSTNAME=0.0.0.0 npm run start`

Production deployment is GitHub-controlled. Set `ADMIN_EMAIL` and, for the first activation, a strong `ADMIN_PASSWORD`. Optional variables are `ADMIN_LOGIN_ID`, `ADMIN_NAME`, and `ADMIN_PHONE`. Keep `ADMIN_FORCE_RESET=false` during normal operation.

The first successful deployment creates the real Super Admin and retires all known demo access. Later deployments keep that state without resetting the administrator password. See `docs/source/11_Production_Activation.md` for the activation and password-recovery procedure.

Use `npm.cmd run db:seed:demo` only for intentional local demo data. Do not connect this repository to the Chalin project. This repository deploys to the Railway project named `Eugene Jersey Management`.

## Important Files

- `prisma/schema.prisma`: Database model.
- `prisma/migrations`: Production migrations.
- `prisma/seed.ts`: Intentional local demo data.
- `scripts/bootstrap-admin.ts`: Manual Super Admin bootstrap utility.
- `scripts/activate-production.ts`: Idempotent Railway production activation and demo retirement.
- `docs/source/11_Production_Activation.md`: GitHub-only production activation runbook.
- `src/app/login/page.tsx`: Role-detect login UI.
- `src/app/api/auth/login/route.ts`: Staff/admin/supplier login backend.
- `src/app/buyer/login`: Buyer login and SMS recovery.
- `src/app/admin`: Super Admin command center and actions.
- `src/app/dashboard`: Shop dashboard.
- `src/components/design/design-studio.tsx`: Jersey design studio.
- `src/lib/auth.ts`: Staff/admin session helpers.
- `src/lib/buyer-session.ts`: Buyer session helpers.
- `src/lib/rbac.ts`: Role permissions.
- `src/lib/dashboard-access.ts`: Page-level dashboard route access rules.
- `src/lib/audit.ts`: Activity logging.

## AI Handoff Notes

Before editing:

1. Inspect the current branch and pull-request diff.
2. Do not touch unrelated user changes.
3. Keep Chalin projects separate.
4. Preserve role-safe redirects and tenant isolation.
5. Run lint, TypeScript, tests, and build before merging.
6. If changing the database, add a Prisma migration and update local demo data when relevant.
7. If changing design studio behaviour, test selection, movement, mirror view, zoom, and mobile layout.
8. Use GitHub pull requests and Railway deployment as the production source of truth.

Generated Word docs live in `docs/word` when `npm.cmd run docs:generate` is run.

## Current Diagnostic

Read `docs/source/10_System_Diagnostic_Progress_and_Roadmap.md` before planning the next major update. It records the latest system check, live route checks, launch blockers, design studio gaps, Paystack/Arkesel setup direction, and the recommended implementation order.

Google Drive documentation pack: https://drive.google.com/drive/folders/1oe55Rtc-MipRfi1_5fdJKxahJ-aYWYEj

Highest-priority status from the latest audit:

- Production activation now creates the real administrator from Railway variables and retires demo access automatically.
- GitHub Actions validates migrations, lint, TypeScript, tests, and build on pull requests.
- Dashboard pages have central page-level role guards in `src/lib/dashboard-access.ts`.
- POS, cart checkout, and public ordering use transaction-safe conditional stock decrements.
- Design Studio has undo, redo, delete selected, grouped templates, richer shapes, improved selection math, and clearer machine connection details.
- Still needed: persistent saved design jobs, duplicate/copy/paste, multi-select/grouping, deeper machine path conversion, broader browser/mobile tests, and production Paystack/Arkesel monitoring.
