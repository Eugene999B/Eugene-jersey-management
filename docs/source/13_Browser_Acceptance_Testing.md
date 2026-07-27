# Browser Acceptance Testing

Eugene Jersey Management uses Playwright and Chromium to verify real browser behaviour after the normal lint, TypeScript, Vitest and production-build gates.

## Current acceptance coverage

The suite verifies:

- staff credential inputs do not exist until the user deliberately opens them;
- unauthenticated users cannot open protected administrator routes;
- an unrestricted Super Admin can sign in, refresh and navigate between dedicated admin pages;
- a support-only platform worker is redirected to Support and cannot open Security directly;
- a tenant owner remains signed in across dashboard refreshes;
- logout uses the POST workflow and returns to an empty login screen;
- the login control remains usable without horizontal overflow on a mobile viewport.

## Disposable test identities

`scripts/seed-e2e.ts` creates three identities and one tenant only when all of these safeguards are satisfied:

- `E2E_TESTING=true`;
- `NODE_ENV` is not `production`;
- `E2E_PASSWORD` is present and at least 12 characters long.

The script is intended for disposable local or CI databases. It must never be run against production.

## Local run

1. Install the main application dependencies with `npm ci`.
2. Install the isolated browser-test dependencies with `npm --prefix e2e ci`.
3. Build the application with `npm run build`.
4. Install Chromium with `npm --prefix e2e run install:chromium`.
5. Set a disposable database, `NODE_ENV=test`, `E2E_TESTING=true` and `E2E_PASSWORD`.
6. Run `npm run e2e:seed`.
7. Run `npm run test:e2e`.

Playwright starts the built standalone application automatically on `http://localhost:3000` unless `E2E_BASE_URL` overrides it.

## Failure evidence

CI retains the Playwright HTML report, traces, screenshots, videos and console log for five days. A failed browser journey blocks the pull request even when compilation and unit tests succeed.
