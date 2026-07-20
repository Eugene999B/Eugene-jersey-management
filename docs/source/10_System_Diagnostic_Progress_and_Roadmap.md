# Eugene Jersey Management - System Diagnostic, Progress, and Roadmap

This document records the current project health, verified checks, launch blockers, and next implementation priorities for the Eugene Jersey Management sports shop platform.

Live app: https://web-production-8ee56.up.railway.app

GitHub repo: https://github.com/Eugene999B/Eugene-jersey-management

Local path: C:\Users\DDK\Documents\Jersey\sports-shop-platform-github-ready

Google Drive documentation pack: https://drive.google.com/drive/folders/1oe55Rtc-MipRfi1_5fdJKxahJ-aYWYEj

Drive documents:

- AI Handoff and Current Progress: https://docs.google.com/document/d/1fReHMGdAozFXHziRxFzRZoMEeH9uLDc3fKjvy1Ts52w/edit?usp=drivesdk
- Setup, Deployment, Paystack, and Arkesel: https://docs.google.com/document/d/1SZ1TUTuE_RG60ez_7zLxIW0NnWNxW_KMWRzlIjGinks/edit?usp=drivesdk
- Feature Guide and Design Studio Manual: https://docs.google.com/document/d/1vvXdQ1HZxWUF3fyf5plqESvt53RS9LKW8wQXrsapay4/edit?usp=drivesdk
- System Diagnostic and Future Roadmap: https://docs.google.com/document/d/1X41sGCQytG0yZSuzx3G2Jz8G9YFtbuyThbJ5NP1sh28/edit?usp=drivesdk

## Current State

The project is a full-stack Next.js App Router platform. The frontend, backend route handlers, server actions, authentication, Prisma database access, public storefronts, staff dashboard, admin system, supplier portal, payment hooks, messaging hooks, and design studio all live in one Next.js application.

The app is currently deployable and running on Railway. It is not yet ready for paid production onboarding until the launch blockers below are fixed.

## Diagnostic Commands Run

These checks passed:

- npm.cmd run lint
- npx.cmd tsc --noEmit
- npm.cmd test
- npx.cmd prisma validate
- npm.cmd audit --audit-level=moderate
- npm.cmd run build

Test result summary:

- Vitest: 1 test file passed, 3 tests passed.
- npm audit: 0 moderate-or-higher vulnerabilities found.
- Prisma schema: valid.
- Production build: successful.

Known build warning:

- Turbopack reports an "unexpected file in NFT list" warning through next.config.ts -> src/lib/media-storage.ts -> src/app/api/uploads/route.ts.
- This does not stop the build, but it should be cleaned before serious production scaling.

## Live Site Checks Run

Public routes responded:

- / returned 200.
- /login returned 200.
- /shops returned 200.
- /shop/accra-pro-sports returned 200.
- /buyer/login returned 200.
- /cart returned 200.

Unauthenticated protected routes redirected to login:

- /dashboard redirected to /login?next=/dashboard.
- /admin redirected to /login?next=/admin.
- /supplier redirected to /login?next=/supplier.

Seeded live account checks:

- YPMS-ADMIN-ROOT with Ghana123 opened /admin.
- APS-OWNER with Ghana123 opened /dashboard.
- APS-DESIGNER with Ghana123 opened /dashboard/designs.
- APS-SUPPLIER with Ghana123 opened /supplier.

## Launch Blockers

### 1. Production seed still creates demo accounts

railway.toml runs npm run db:seed before every deploy. The current seed creates demo accounts and defaults to Ghana123 unless SEED_DEMO_PASSWORD is set.

Risk:

- Demo credentials can remain live in production.
- Deployments can reset seeded demo user passwords.
- This is not acceptable for a platform that will be sold to shops.

Required fix:

- Split demo seed from production bootstrap.
- Create a secure one-time platform admin bootstrap command.
- Make production seeding refuse to run unless an explicit SAFE_DEMO_SEED=true variable is set.
- Remove Ghana123 from any production path.

### 2. Dashboard page-level permissions are incomplete

The proxy blocks unauthenticated users, Super Admin dashboard access, and supplier dashboard access. The sidebar hides pages based on role. However, many dashboard pages do not enforce their own permission group.

Observed live issue:

- A designer can directly open /dashboard/pos and /dashboard/settings.
- A cashier can directly open /dashboard/designs and /dashboard/staff.

Risk:

- Staff may view pages their role should not view.
- Write actions are more protected, but page data visibility and professional access control are not complete.

Required fix:

- Add a helper such as requireDashboardPermission(permissionKey).
- Apply it to every dashboard page.
- Add tests for direct URL access by Cashier, Designer, Accountant, Viewer, Owner, Manager, and Supplier.

### 3. Stock decrement can race under concurrent checkout

POS, cart checkout, and public order flows check stock before a transaction, then decrement stock inside the transaction without a conditional stock guard.

Risk:

- Two checkouts can pass the pre-check at the same time and push stock below zero.

Required fix:

- Use conditional updateMany with stockQty >= quantity inside the transaction.
- Fail the checkout if the update count is 0.
- Add concurrency tests for POS and online checkout.

### 4. Design studio machine integration is not production-ready

The design studio has Web Serial sending, machine status, HPGL export, DXF export, SVG export, and tech pack export. However, direct cutter support is still a prototype.

Current limitations:

- Machine status is only idle, connecting, sent, unsupported, or failed.
- It does not show the connected device name, USB vendor/product details, or selected port.
- It does not show the exact error message when a connection fails.
- HPGL output is currently generic and does not fully convert every visible artwork path into machine-ready cut paths.
- There is no machine compatibility test screen.
- There is no per-shop saved machine profile and calibration result.

Required fix:

- Add selectedDeviceName, selectedDeviceInfo, lastMachineError, and lastSentAt.
- Add "Connect device" separate from "Send to cutter".
- Add device capability checks and clear error copy.
- Add machine profiles for common cutting plotters used by shops.
- Build a real SVG-to-cut-path pipeline for HPGL, DXF, and future device bridges.

### 5. Design editor lacks core professional editing controls

The current editor has selection, movement, layers, text controls, image placement, shape placement, zoom, pan, export, and material controls. It still needs the editor basics users expect.

Missing controls:

- Undo
- Redo
- Delete selected
- Duplicate selected
- Copy and paste selected
- Keyboard shortcuts
- Snap indicators
- Multi-select
- Group and ungroup
- Persistent saved design jobs
- Load saved job back into the editor

Required fix:

- Add a history stack with undo/redo.
- Add deleteSelected and duplicateSelected.
- Persist productionManifest/canvasJson to DesignJob.
- Add load/edit saved DesignJob.
- Add browser interaction tests for selection, move, undo, redo, delete, zoom, and export.

### 6. Design templates need grouping and expansion

Shape templates exist, but they are a flat list.

Required groups:

- Animals: lion, eagle, paw, tiger, horse, dragon, snake, elephant.
- Sports: football, basketball, tennis ball, volleyball, boxing glove, boot, whistle, trophy.
- Objects: crown, shield, star, lightning, flame, badge, ribbon, wings.
- Ghana and club styles: kente stripes, flags, initials, number shields.
- Jersey styles: plain, football club, basketball, rugby, goalkeeper, training kit, tracksuit.

Required fix:

- Create grouped template data with category, tags, preview, sport, and recommended placement.
- Add template search and filter.
- Add one-click insert to selected side of jersey.

### 7. Buyer signup updates password before SMS verification

When a buyer requests a login code, the code currently upserts the buyer and updates passwordHash immediately.

Risk:

- A person can trigger a password change for a phone number before proving they control the SMS code.
- The attacker still needs the SMS code to log in, but it can lock out or confuse the real buyer.

Required fix:

- Store pending buyer registration/reset state until SMS verification succeeds.
- Only update passwordHash after consumePhoneCode succeeds.

### 8. Paystack online payment flow needs full production completion

The current app initializes Paystack from the backend, stores provider references, supports shop subaccount fields, and processes signed webhooks.

Still needed:

- Verify transaction on callback before showing payment success.
- Mark amount/currency mismatch payments as failed, not just failed events.
- Add refund handling.
- Add webhook retry visibility.
- Add Paystack subaccount onboarding flow for each shop.
- Add a payment settings test button.
- Add POS card/mobile money gateway support. Current POS card path records a sandbox payment, not a real card charge.

Official references:

- Paystack Accept Payments: https://paystack.com/docs/payments/accept-payments/
- Paystack Verify Payments: https://paystack.com/docs/payments/verify-payments/
- Paystack Split Payments: https://paystack.com/docs/payments/split-payments/
- Paystack Transaction API: https://paystack.com/docs/api/transaction/

### 9. Arkesel/SMS messaging needs production controls

The app has provider hooks for SMS and WhatsApp, an Arkesel SMS send path, verification codes, debt reminders, order confirmations, and receipt messages.

Still needed:

- Confirm exact Arkesel production endpoint and payload with the current Arkesel dashboard.
- Store provider delivery responses consistently.
- Add retry queue and failed-message dashboard.
- Add SMS balance warning.
- Add message templates per shop.
- Add opt-out and consent controls for marketing SMS.
- Add WhatsApp provider decision and approval process.

Official reference:

- Arkesel developer docs: https://developers.arkesel.com/

### 10. Image handling is split between server uploads and design-only browser blobs

Server image optimization exists at /api/uploads and stores optimized WebP images as MediaAsset records.

Design studio image insertion currently optimizes in the browser and uses object URLs.

Risk:

- Design images are not automatically persisted.
- A saved design job cannot reliably reopen the same uploaded image unless the image is uploaded to server storage.

Required fix:

- Use /api/uploads from the design studio for production assets.
- Store MediaAsset ID in DesignJob.canvasJson.
- Support R2/S3 for production storage.

### 11. Mobile layout needs a deeper usability pass

Mobile navigation is present and sign out exists, but the operational dashboard still relies on horizontal scrolling and very dense panels.

Required fix:

- Add a mobile drawer or bottom quick nav for dashboard sections.
- Make design studio inspector collapsible on mobile.
- Add sticky editor toolbar for mobile.
- Add Playwright mobile screenshot tests for /login, /shops, /shop/[slug], /dashboard, /dashboard/designs, /admin, and /supplier.

### 12. Automated coverage is too small for the feature size

The platform currently has only one test file with three tests.

Required fix:

- Add unit tests for RBAC page gates.
- Add payment tests for Paystack webhook verification and mismatch handling.
- Add stock concurrency tests.
- Add buyer SMS verification tests.
- Add design reducer/history tests after undo/redo is implemented.
- Add end-to-end login and checkout tests.

## Security Improvements Needed Before Real Shops

- Remove demo seed from production deploy.
- Enforce page-level dashboard permissions.
- Add two-factor authentication for platform admin and shop owners.
- Add production admin bootstrap command.
- Add CSRF strategy review for API routes using cookie sessions.
- Reduce CSP unsafe-inline and unsafe-eval where possible.
- Add audit entries for sensitive reads and all staff/admin mutations.
- Add per-shop data export and deletion policy.
- Add rate limits for checkout, tracking verification, Paystack callbacks, uploads, and staff login.
- Ensure reset links and temporary passwords are never logged in production.
- Add admin session/device list and forced logout.

## Design Studio Current Feature Explanation

The design studio is the creative production surface for jersey and sports apparel work.

Current tools:

- Brand tab: color palettes, garment style, design mode, and jersey identity.
- Assets tab: insert a photo/logo, mask it, resize it, rotate it, and position it.
- Text tab: edit player name, number, sponsor, crest, text effect, spacing, position, scale, rotation, opacity, and lock state.
- Layout tab: choose pattern system, fabric texture, vector shape, and insert basic object templates.
- Layers tab: turn layers on/off and select text/image/shape layers.
- Production tab: material preset, heat press recipe, sheet size, garment scale, sheet margin, sheet offset, cutter profile, blade settings, contour, bleed, nesting, mirror cut, registration marks, weed lines, and Web Serial send.
- Quality tab: production score, cut complexity, press estimate, and checklist.
- Export tab: SVG, PLT, DXF, JSON production job, and printable tech pack.

How it should work after next update:

- User selects an object by clicking it on the jersey.
- User moves selected object by dragging or using arrow controls.
- Undo and redo move backward/forward through design state.
- Delete selected removes the active text/image/shape layer or hides it.
- Templates are grouped by type and inserted directly into the jersey.
- Machine panel shows "Connected to [device name]" or a clear error.
- Saved jobs can be reopened and exported again.

## Admin Account Setup Way Forward

Current test admin:

- Login ID: YPMS-ADMIN-ROOT
- Password: Ghana123

Production plan:

1. Create a one-time admin bootstrap command.
2. Require a strong password and phone number.
3. Require SMS verification or 2FA before activating the platform admin.
4. Disable demo accounts.
5. Create admin worker accounts from /admin only.
6. Track admin worker activity in audit logs.
7. Prevent a platform admin from suspending himself.

## Paystack Setup Way Forward

Use one platform PAYSTACK_SECRET_KEY on the server. Never expose it in the browser.

For each shop:

1. Collect settlement account/mobile money details.
2. Create or store a Paystack subaccount code.
3. Put that subaccount code in Dashboard > Settings.
4. During online checkout, initialize Paystack with amount, email, reference, callback_url, subaccount, transaction_charge, and bearer.
5. Paystack redirects the buyer to hosted checkout.
6. The app receives a webhook and verifies x-paystack-signature.
7. The app verifies reference, amount, currency, and status before marking payment successful.
8. The order tracking page should show paid only after verification.

## Arkesel Setup Way Forward

For SMS:

1. Create an Arkesel account.
2. Get the API key from the Arkesel dashboard.
3. Register/approve a sender ID.
4. Set SMS_PROVIDER=arkesel.
5. Set ARKESEL_API_KEY or SMS_API_TOKEN.
6. Set ARKESEL_SENDER_ID or SMS_SENDER_ID.
7. Send a test code to a staff phone.
8. Confirm delivery status and billing in Arkesel.
9. Add templates for verification, receipts, debt reminders, pickup codes, delivery codes, and campaign messages.

For WhatsApp:

- Choose a provider and verify business approval requirements.
- Add a queue and template approval flow.
- Do not treat WhatsApp as ready until provider callbacks and delivery failures are handled.

## Recommended Next Implementation Order

1. Fix production seed safety and admin bootstrap.
2. Add page-level dashboard permission guards.
3. Fix checkout stock race conditions.
4. Add design undo, redo, delete selected, duplicate, and history.
5. Add grouped design template library.
6. Add machine connection details, error reporting, and compatibility test.
7. Persist design jobs and uploaded design assets.
8. Complete Paystack callback verification and POS real payment path.
9. Harden buyer SMS registration and password reset.
10. Add mobile dashboard/design usability improvements.
11. Add E2E tests and screenshot tests.
12. Clean the Turbopack media-storage warning.

## AI Handoff Instructions

Any AI or developer continuing this repository should:

1. Read README.md first.
2. Read this diagnostic document second.
3. Read prisma/schema.prisma before database work.
4. Read src/lib/rbac.ts before access-control work.
5. Read src/proxy.ts and src/lib/auth.ts before login work.
6. Read src/components/design/design-studio.tsx before design work.
7. Never touch Chalin projects.
8. Keep Railway project separation: this app belongs to Eugene Jersey Management.
9. Do not assume frontend and backend are separate.
10. Run lint, TypeScript, tests, Prisma validate, audit, and build before pushing.
