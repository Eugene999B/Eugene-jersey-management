# Eugene Jersey Management - Production Account Activation

Updated: 2026-07-26

## Source of truth

Production activation is controlled by GitHub and Railway deployment. No local computer command is required.

Railway runs the following before every deployment:

```text
npx prisma migrate deploy && npm run production:activate
```

The activation command reads the administrator identity from Railway service variables.

## Required Railway variables

```text
ADMIN_EMAIL
ADMIN_LOGIN_ID
ADMIN_NAME
ADMIN_PHONE
ADMIN_PASSWORD
ADMIN_FORCE_RESET=false
```

`ADMIN_EMAIL` must be a real production email address. `ADMIN_PASSWORD` must be at least 12 characters when the administrator is first created.

The default login ID is `EJM-ADMIN-ROOT` when `ADMIN_LOGIN_ID` is not supplied.

## First successful deployment

The first deployment after this change is merged will:

1. Apply all Prisma migrations.
2. Create the real platform Super Admin when it does not already exist.
3. Deactivate all seeded demo staff identities.
4. Invalidate active demo staff sessions.
5. Deactivate the seeded demo buyer and supplier.
6. Suspend the seeded Accra Pro Sports demo shop.
7. Disable the demo storefront and public ordering.
8. Record the activation in the audit log.

## Later deployments

The activation process is idempotent.

- It keeps the real administrator active.
- It keeps demo access retired.
- It does not overwrite an existing administrator password.
- It only resets the password when `ADMIN_FORCE_RESET=true` and a valid `ADMIN_PASSWORD` is present.

After the first successful login, `ADMIN_PASSWORD` may be removed from Railway Variables while `ADMIN_FORCE_RESET` remains `false`.

## Production login

Open `/login` and sign in with either:

- the value stored in `ADMIN_LOGIN_ID`, or
- the value stored in `ADMIN_EMAIL`.

A successful platform administrator login redirects to `/admin`.

## Recovery password reset

For an intentional administrator password reset:

1. Set a new strong `ADMIN_PASSWORD` in Railway.
2. Set `ADMIN_FORCE_RESET=true`.
3. Deploy the service once.
4. Confirm the new administrator password works.
5. Set `ADMIN_FORCE_RESET=false` and remove `ADMIN_PASSWORD`.

## Safety controls

- A tenant owner or shop worker cannot be promoted automatically.
- A seeded demo address cannot become the production administrator.
- A real account cannot be displaced when the requested Login ID is already assigned.
- Users connected to a suspended shop are rejected during login.
- Demo data remains preserved for audit/history, but all demo access is disabled.
