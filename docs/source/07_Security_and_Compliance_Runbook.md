# Sports Shop Platform - Security and Compliance Runbook

Controls already implemented and production hardening tasks.

## Implemented Controls

- bcrypt password hashing with cost factor 12.
- HTTP-only, same-site session cookie signed with jose.
- Protected admin and dashboard routes through Next proxy.
- Role checks in page actions and API routes.
- Tenant-scoped queries using session.shopId.
- Account lockout after 5 failed login attempts within a 15 minute window.
- Zod validation on server actions and API payloads.
- Security headers: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy.
- AuditLog records for login, admin, staff, catalog, POS, settings, and order changes.

## Production Must-Do

- Replace development SESSION_SECRET with a long random secret.
- Remove demo passwords and seed users before real launch.
- Use HTTPS everywhere.
- Enable database backups and point-in-time recovery.
- Store payment and notification secrets in the hosting provider, not in source code.
- Add 2FA before onboarding high-value tenants.
- Add rate limiting to login, reset password, checkout, and public tracking routes.
- Add centralized logging and alerting.

## Data Protection

- Keep each tenant's data scoped by shopId.
- Use exports and deletion workflows when a customer requests their data.
- Minimize stored payment data. Use provider references instead of card details.
- Restrict financial reporting to Owner, Manager, and Accountant roles.

## Incident Response

- Suspend affected shop if tenant compromise is suspected.
- Rotate SESSION_SECRET to invalidate sessions if session signing key exposure is suspected.
- Rotate payment and SMS provider API keys from provider dashboards.
- Review AuditLog for suspicious actions.
- Restore from backup only after validating the recovery point.
