# Temporary Dependency Security Exception

## Context

On 4 August 2026, npm began reporting high-severity advisory `GHSA-7p8r-x3mc-p8w7` (`source: 1130719`) against `fast-uri`.

The repository is already locked to `fast-uri` 4.1.1, the newest published release available when this exception was created. npm's advisory requires 4.1.2, which was not yet published.

The reported chain is limited to:

- `@prisma/streams-local`
- its nested Ajv validator
- `fast-uri`

The committed npm lock marks the Prisma stream package and nested Ajv package as `devOptional`.

## Enforcement

The CI policy does not ignore high-severity audits broadly.

`scripts/verify-dependency-security.mjs` permits only this exact temporary set:

- `fast-uri`
- inherited Ajv finding
- advisory source `1130719`
- the reviewed installation paths
- committed `fast-uri` version 4.1.1
- dev-optional Prisma stream metadata

Any different high or critical advisory fails the build.

The exception expires on 4 September 2026. A published fixed `fast-uri` or Prisma release must replace it before that date.

## Railway runtime proof

After the Next.js production build, `scripts/verify-standalone-runtime-dependencies.mjs` scans the deployable `.next/standalone` server.

The build fails if the deployable runtime contains:

- `@prisma/streams-local`
- `fast-uri`
- Hono
- PostCSS

This separates the transparent full dependency report from the packages actually shipped to Railway.

## Removal procedure

When the upstream fix is published:

1. Upgrade the affected dependency or Prisma release.
2. Regenerate `package-lock.json` from npm.
3. Run the full audit and production build.
4. Confirm the standalone runtime scan remains green.
5. Remove the temporary advisory exception and its expiry logic.
6. Keep the general rule that every unreviewed high or critical advisory blocks deployment.
