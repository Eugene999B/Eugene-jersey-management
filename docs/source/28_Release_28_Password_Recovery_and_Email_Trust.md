# Release 28 — Password Recovery and Email Trust

## Purpose

Release 28 repairs password recovery before Paystack configuration and turns transactional email into an observable production service.

## Confirmed problems

- `/forgot-password` currently serves staff accounts only.
- Entering a staff email still sends an SMS to the phone on that account; the reset page then requires the phone again.
- A staff phone shared by more than one active user is deliberately rejected, but the current screen does not explain that recovery cannot continue.
- Buyer accounts have no dedicated forgotten-password route.
- Buyer email verification can send through Resend only when Railway has `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` and a verified `EMAIL_FROM`.
- The administrator integration page does not currently report transactional-email health.
- Syntax validation and a valid mail domain cannot prove a mailbox belongs to a real person. Ownership is proven only after the recipient receives and submits a one-time code.

## Delivery slices

### Slice A — Recovery challenge foundation

- Add one platform-global password-recovery challenge model for staff and buyer accounts.
- Support SMS and email delivery without storing plaintext codes.
- Use opaque public challenge tokens, expiry, attempt limits, one-time consumption and rate limits.
- Keep account-discovery responses generic.
- Revoke existing sessions after a successful password reset.

### Slice B — Staff recovery

- Accept Login ID, email or phone.
- Let the user choose SMS or email OTP.
- Keep `/forgot-password` and `/reset-password` as the staff recovery routes.
- Verify the account is active and its shop is active before sending or resetting.

### Slice C — Buyer recovery

- Add `/buyer/forgot-password` and `/buyer/reset-password`.
- Add a visible Forgot password link to buyer login.
- Support SMS or email OTP for an active buyer account.

### Slice D — Email trust and operations

- Extract a reusable transactional-email sender from buyer email verification.
- Validate email syntax and recipient-domain MX records before dispatch.
- Add Resend authentication/domain health to `/admin/integrations` without sending a message.
- Record provider references and safe delivery state for recovery messages.
- Add an authenticated Resend webhook endpoint for delivered, delayed, failed and bounced events.
- Never mark an email verified merely because Resend accepted the API request.

## Email legitimacy policy

The system may classify an address as:

1. **Format valid** — the address passes application validation.
2. **Domain deliverable** — the domain publishes mail-exchange records.
3. **Provider accepted** — Resend accepted the outbound request.
4. **Delivered to recipient server** — Resend reported delivery.
5. **Ownership verified** — the user submitted the one-time code.
6. **Bounced/failed** — the provider reported non-delivery.

Only ownership verification should mark an address trusted for account actions. The platform must not claim that a Gmail address belongs to a genuine person, because neither DNS nor a public Gmail API can prove identity.

## Release gate

Keep the pull request draft until Prisma migrations, lint, TypeScript, unit tests, tenant-isolation attacks, production build, desktop/mobile recovery journeys and provider-health tests pass. Paystack remains out of scope.