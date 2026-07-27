# Eugene Jersey Management

Production-ready multi-tenant sports shop platform for jersey shops, sports equipment retailers, suppliers, buyers, and platform admins. The app is built with Next.js App Router, Prisma, PostgreSQL, role-based access, structural tenant isolation, public storefronts, POS, debts, daily closing, supplier/network tools, exports, buyer ordering, chat, optional personal two-factor authentication, and an advanced jersey design studio.

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
- Optional TOTP authenticator protection with encrypted secrets and recovery codes

## Main Areas

- `/login`: Staff, shop, supplier, and platform-admin gateway. Users enter a Login ID first. The system detects the account type and then asks for the correct password step.
- `/login/two-factor`: Short-lived second-factor challenge for accounts that personally enabled 2FA.
- `/account/security`: Personal 2FA controls for shop workers, owners, suppliers and platform administrators.
- `/shops`: Public buyer marketplace. Buyers do not need staff IDs.
- `/shop/[slug]`: Public shop catalog with contact details, ordering, reviews, and chat entry.
- `/buyer/login`: Buyer phone/password login plus SMS setup/recovery.
- `/buyer/security`: Personal optional 2FA controls for buyers.
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
4. When that individual account enabled 2FA, the system requests an authenticator or unused recovery code.
5. Redirect is role-safe and the full session is created only after every enabled factor succeeds.

Shop staff can sign in with their personal worker Login ID or their work email. Supplier accounts use their assigned supplier Login ID or email.

Production Super Admin access is created from Railway `ADMIN_*` variables by the repository-controlled `production:activate` command. The default Login ID is `EJM-ADMIN-ROOT` when `ADMIN_LOGIN_ID` is not supplied.

Seeded demo identities are strictly for intentional local demo setup. Production deployment deactivates seeded demo staff, buyer, supplier, and shop access. Demo credentials must never be published or reused in production.

The login page must not show any Super Admin code. Admin access is detected from assigned Login ID/email and backend role checks.

## Optional Two-Factor Authentication

Two-factor authentication is optional for every account type and disabled by default.

- Buyers, shop workers, owners, managers, suppliers and platform administrators control only their own preference.
- A shop owner or Super Admin cannot secretly enable or disable 2FA for another person.
- Setup requires the current password and a valid six-digit authenticator code.
- Disabling requires the current password plus an authenticator or unused recovery code.
- Enabling or disabling revokes all previous sessions for that account.
- Authenticator secrets are encrypted with AES-256-GCM using the independent `TWO_FACTOR_ENCRYPTION_KEY`.
- Recovery codes are shown only when created, stored only as keyed hashes, and work once.
- Accounts with 2FA off keep the existing Login ID/email and password flow.
- Accounts with 2FA on receive only a short-lived challenge after password verification; the real session is issued after the second factor succeeds.
- Protected accounts fail closed if their encryption configuration or stored secret is unavailable.
- `AccountTwoFactor` is platform-global and blocked from shop-scoped Prisma clients, including interactive transactions.

Do not reuse `SESSION_SECRET` as `TWO_FACTOR_ENCRYPTION_KEY`. Keep both as separate long random Railway secrets.

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
- Platform administrators manage their own optional 2FA from `/account/security`, not from another worker's admin form.

## Buyer Flow

Buyers can:

- Browse all verified shops.
- Search by shop, location, category, sport, or product.
- View each shop's contact details.
- Sign in with phone/password.
- Use SMS setup/recovery.
- Optionally enable personal authenticator security.
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

Set independent long random values for both `SESSION_SECRET` and `TWO_FACTOR_ENCRYPTION_KEY` before testing optional 2FA.

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
npm.cmd run production:purge-demo
```

## Railway Deployment

Railway uses `railway.toml`:

- Build: `npx prisma generate && npm run build`
- Pre-deploy: `npx prisma migrate deploy && npm run production:activate && npm run production:purge-demo`
- Start: `HOSTNAME=0.0.0.0 npm run start`

Production deployment is GitHub-controlled. Set `ADMIN_EMAIL` and, for the first activation, a strong `ADMIN_PASSWORD`. Optional variables are `ADMIN_LOGIN_ID`, `ADMIN_NAME`, and `ADMIN_PHONE`. Keep `ADMIN_FORCE_RESET=false` during normal operation.

Set `TWO_FACTOR_ENCRYPTION_KEY` to a strong independent random value of at least 32 characters before allowing production users to enable 2FA. Existing accounts remain password-only because 2FA is off by default, but protected accounts fail closed if this key later becomes unavailable.

The activation command creates or preserves the real Super Admin and retires demo access. The purge command normally skips. For the one-time permanent cleanup, set `PURGE_DEMO_DATA=PURGE-ACC-PRO-DEMO-2026`, deploy once, verify the application, then remove `PURGE_DEMO_DATA` from Railway.

The purge refuses to run unless an active shop-independent real Super Admin exists. It also refuses when demo identities have references outside the seeded demo tenant. It deletes the seeded Accra Pro Sports tenant, demo users, demo buyer, demo products, stock, orders, payments, suppliers, reviews and related records while preserving the production schema, Prisma migrations and real administrator.

See `docs/source/11_Production_Activation.md` for activation, password recovery and permanent demo-cleanup procedures.

Use `npm.cmd run db:seed:demo` only for intentional local demo data. Do not connect this repository to the Chalin project. This repository deploys to the Railway project named `Eugene Jersey Management`.

## Important Files

- `prisma/schema.prisma` and `prisma/models`: Database models.
- `prisma/models/account-security.prisma`: Optional 2FA account model.
- `prisma/migrations`: Production migrations.
- `prisma/seed.ts`: Intentional local demo data.
- `scripts/bootstrap-admin.ts`: Manual Super Admin bootstrap utility.
- `scripts/activate-production.ts`: Idempotent Railway production activation and demo retirement.
- `scripts/purge-demo-data.ts`: Guarded one-time permanent deletion of seeded production demo data.
- `scripts/verify-tenant-isolation.ts`: Permanent two-shop and platform-global-model attack verification.
- `docs/source/11_Production_Activation.md`: GitHub-only production activation and cleanup runbook.
- `src/app/login/page.tsx`: Role-detect login UI.
- `src/app/login/two-factor`: Optional second-factor challenge and cancellation.
- `src/app/api/auth/login/route.ts`: Staff/admin/supplier password and optional challenge backend.
- `src/app/api/auth/two-factor/route.ts`: Staff and buyer second-factor completion.
- `src/app/api/account/two-factor/route.ts`: Personal enable, disable and recovery-code controls.
- `src/app/account/security/page.tsx`: Workforce personal security page.
- `src/app/buyer/login`: Buyer login and SMS recovery.
- `src/app/buyer/security/page.tsx`: Buyer personal security page.
- `src/lib/two-factor.ts`: Encryption, TOTP and recovery-code primitives.
- `src/lib/two-factor-account.ts`: Optional 2FA account service.
- `src/lib/two-factor-challenge.ts`: Short-lived pre-session challenge token.
- `src/app/admin`: Super Admin platform command center and actions.
- `src/app/dashboard`: Shop dashboard.
- `src/components/design/design-studio.tsx`: Jersey design studio.
- `src/lib/auth.ts`: Staff/admin session helpers.
- `src/lib/buyer-session.ts`: Buyer session helpers.
- `src/lib/tenant-db.ts`: Structural shop-scoped database enforcement.
- `src/lib/rbac.ts`: Role permissions.
- `src/lib/dashboard-access.ts`: Page-level dashboard route access rules.
- `src/lib/audit.ts`: Activity logging.

## AI Handoff Notes

Before editing:

1. Inspect the current branch and pull-request diff.
2. Do not touch unrelated user changes.
3. Keep Chalin projects separate.
4. Preserve role-safe redirects, tenant isolation and the separation between pre-session 2FA challenges and real sessions.
5. Run dependency audit, Prisma generation/migrations, lint, TypeScript, tests, tenant-isolation attacks, production build and Chromium before merging.
6. If changing the database, add a Prisma migration and update disposable seed data when relevant.
7. Never make 2FA mandatory without a new explicit product decision. The approved rule is optional personal opt-in/opt-out for every account type.
8. Never expose, log or store plaintext authenticator secrets or recovery codes after setup.
9. If changing design studio behaviour, test selection, movement, mirror view, zoom, save, reload and mobile layout.
10. Use GitHub pull requests and Railway deployment as the production source of truth.
11. Never weaken or bypass the `PURGE_DEMO_DATA` confirmation, tenant-isolation tests or protected-account fail-closed behaviour.

Generated Word docs live in `docs/word` when `npm.cmd run docs:generate` is run.

## Current Diagnostic

Read `docs/source/10_System_Diagnostic_Progress_and_Roadmap.md` before planning the next major update. It records the latest system check, launch blockers, optional 2FA rules, Design Studio gaps, production integration direction, and recommended implementation order.

Google Drive documentation pack: https://drive.google.com/drive/folders/1oe55Rtc-MipRfi1_5fdJKxahJ-aYWYEj

Highest-priority status from the latest audit:

- Production activation creates the real administrator from Railway variables and retires demo access automatically.
- Structural tenant database isolation and permanent two-shop attack verification are active.
- Desktop/mobile Chromium covers shop-owner, public, supplier and platform-admin surfaces.
- Optional personal 2FA covers buyer, shop worker, owner, supplier and platform-admin accounts, with encrypted secrets, recovery codes, session revocation and protected-account browser journeys.
- POS, cart checkout, and public ordering use transaction-safe conditional stock decrements.
- Design Studio has undo, redo, delete selected, grouped templates, richer shapes, improved selection math, and clearer machine connection details.
- Next major programme: Production Integration Health for Paystack, Arkesel, WhatsApp, storage and scheduled jobs, followed by Design Studio reliability and commercial controls.
