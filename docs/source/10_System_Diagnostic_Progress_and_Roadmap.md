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

## Launch Blockers and Resolved Items

### 1. Resolved: production deploy no longer runs demo seed

railway.toml now runs only `npx prisma migrate deploy` before deployment. The demo seed refuses to run in production unless `SAFE_DEMO_SEED=true` or the explicit demo command is used.

Implemented:

- `npm run db:seed:demo` runs demo data intentionally.
- `npm run setup:demo` uses the demo seed path for local setup.
- `npm run admin:bootstrap` creates or updates a real Super Admin from environment variables.
- `scripts/bootstrap-admin.ts` requires `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD`.
- Railway pre-deploy no longer creates or refreshes Ghana123 demo accounts.

Remaining production action:

- Rotate any old live demo passwords before selling to shops.
- Create the real production Super Admin using the bootstrap command and a strong password.

### 2. Resolved: dashboard page-level permissions now have a central guard

The proxy now uses `src/lib/dashboard-access.ts` to block direct dashboard URLs when a staff role should not access the page.

Implemented:

- Designer is allowed on `/dashboard/designs` but blocked from `/dashboard/pos` and `/dashboard/settings`.
- Cashier is allowed on `/dashboard/pos` but blocked from `/dashboard/designs` and `/dashboard/staff`.
- Owner, Manager, Accountant, Inventory Clerk, and Viewer have explicit page groups.
- RBAC tests were expanded for blocked and allowed dashboard routes.

Remaining work:

- Add page-level server assertions on sensitive dashboard pages as a second layer.
- Add browser tests that verify blocked users stay out after direct navigation.

### 3. Resolved: checkout stock decrement is transaction-safe

POS, cart checkout, and public order flows now decrement stock with `updateMany` guarded by `stockQty >= quantity` inside the transaction.

Implemented:

- POS checkout returns HTTP 409 when stock is gone before the transaction completes.
- Public online order redirects with a stock error instead of overselling.
- Cart checkout redirects with a stock error instead of overselling.

Remaining work:

- Add true concurrent checkout tests against a test database.
- Add a user-friendly stock message near affected cart/POS lines.

### 4. Partially improved: Design studio machine integration

The design studio has Web Serial send, machine status, HPGL export, DXF export, SVG export, and tech pack export. Direct cutter support is still a browser/device-dependent feature, but the interface now gives clearer connection feedback.

Implemented:

- Separate Test and Send buttons.
- Device name based on browser serial vendor/product info where available.
- Last sent time.
- Clear machine error messages.
- Unsupported-browser message for environments without Web Serial.

Still limited:

- HPGL output is currently generic and does not fully convert every visible artwork path into machine-ready cut paths.
- There is no per-shop saved machine profile and calibration result.

Next fix:

- Add device capability checks and clear error copy.
- Add machine profiles for common cutting plotters used by shops.
- Build a real SVG-to-cut-path pipeline for HPGL, DXF, and future device bridges.

### 5. Partially improved: Design editor professional controls

The editor now has selection, movement, layers, text controls, image placement, shape placement, zoom, pan, export, material controls, undo, redo, delete selected, keyboard shortcuts, and safer selection math for scaled jerseys.

Implemented:

- Undo and redo history stack.
- Delete selected text/image/shape layer.
- Ctrl/Cmd+Z, Ctrl/Cmd+Y, Ctrl/Cmd+Shift+Z, Delete, and Backspace shortcuts.
- Scaled-jersey hit testing and dragging fixes.

Still missing:

- Duplicate selected
- Copy and paste selected
- Snap indicators
- Multi-select
- Group and ungroup
- Persistent saved design jobs
- Load saved job back into the editor

Required fix:

- Add duplicateSelected.
- Persist productionManifest/canvasJson to DesignJob.
- Add load/edit saved DesignJob.
- Add browser interaction tests for selection, move, undo, redo, delete, zoom, and export.

### 6. Partially improved: design templates are grouped and expanded

Shape templates are now grouped and expanded with more vector symbols.

Implemented groups:

- Animals: lion, eagle, paw, wing.
- Sports: football, basketball, volleyball, tennis, boot, boxing.
- Objects: trophy, crown, lightning, flame, shield, star.
- Ghana and club starters: kente sash, circle initials, captain crown, victory star.

Still needed:

- Add template search and filter.
- Add richer previews and more local badge packs.
- Add saved team kit templates per shop.

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

- Rotate or disable any old demo users that existed before production seed removal.
- Keep page-level dashboard permissions and add server-page assertions for sensitive pages.
- Add two-factor authentication for platform admin and shop owners.
- Run the production admin bootstrap command with a strong real password.
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
- Layout tab: choose pattern system, fabric texture, vector shape, and insert grouped animal, sports, object, Ghana, and club starter templates.
- Layers tab: turn layers on/off and select text/image/shape layers.
- Production tab: material preset, heat press recipe, sheet size, garment scale, sheet margin, sheet offset, cutter profile, blade settings, contour, bleed, nesting, mirror cut, registration marks, weed lines, Web Serial test, and Web Serial send.
- Quality tab: production score, cut complexity, press estimate, and checklist.
- Export tab: SVG, PLT, DXF, JSON production job, and printable tech pack.
- Top toolbar: select/image/text/shape/cut/press/inspect tools, undo, redo, delete selected, reset, and export shortcuts.

How it should work after next update:

- User selects an object by clicking it on the jersey.
- User moves selected object by dragging or using arrow controls.
- Undo and redo now move backward/forward through design state.
- Delete selected now removes the active text/image/shape layer or hides it.
- Templates are now grouped by type and inserted directly into the jersey.
- Machine panel now shows a selected device name where the browser provides it, plus clear errors.
- Saved jobs can be reopened and exported again.

## Admin Account Setup Way Forward

Current test admin:

- Login ID: YPMS-ADMIN-ROOT
- Password: Ghana123

Production plan:

1. Run the one-time admin bootstrap command with `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD`.
2. Require a strong password and phone number.
3. Require SMS verification or 2FA before activating the platform admin.
4. Disable or rotate any old demo accounts.
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

1. Rotate any old demo credentials on the live Railway database and bootstrap the real Super Admin.
2. Add browser/E2E tests for direct dashboard role blocking, login, checkout, and design editor controls.
3. Persist design jobs and uploaded design assets so shops can reopen production work.
4. Add duplicate, copy/paste, multi-select, group/ungroup, snap indicators, and template search to the design studio.
5. Build a real SVG-to-cut-path conversion pipeline for HPGL/DXF and per-shop machine calibration profiles.
6. Complete Paystack production checkout, callbacks, subaccount settlement review, refunds, and reconciliation.
7. Harden buyer SMS registration and password reset so passwords update only after SMS verification.
8. Add mobile dashboard/design usability improvements and screenshot tests.
9. Add server-page assertions on sensitive dashboard pages as a second RBAC layer.
10. Add stock concurrency tests against a test database.
11. Add queue/retry/monitoring for Arkesel SMS, WhatsApp, receipts, debt reminders, and pickup/delivery codes.
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
