# Release #17 — Production Integration Health

Updated: 2026-07-27

## Purpose

Release #17 separates configuration presence from real provider reachability. The administrator receives a protected, read-only control centre at `/admin/integrations` for Paystack, Arkesel, WhatsApp, durable media storage, PostgreSQL and the reservation-release scheduler.

Health checks do not create payments, send messages, upload files or release stock.

## Payment ownership rule

1. The ESM administrator owns the main Paystack integration configured by `PAYSTACK_SECRET_KEY`.
2. Every store receives its own Paystack subaccount and settlement bank destination.
3. Customer payments for a store are initialized with that store's `subaccount` code.
4. The store receives its settlement through its own subaccount.
5. The configured flat `transaction_charge`, when present, remains with the ESM administrator main account.
6. Platform subscriptions, communication-credit purchases and other EJM-owned charges belong to the administrator main account.
7. A store owner can maintain settlement contact details and accepted methods, but cannot assign the Paystack subaccount, EJM charge or Paystack fee bearer.
8. Only a platform administrator with Billing permission can verify and save those routing fields.
9. No store balance may be represented as another store's money or manually routed through another tenant.

Paystack subaccounts and flat transaction charges are verified through read-only provider requests before the administrator replaces an existing route.

## Read-only provider probes

### Paystack

- Calls the authenticated balance endpoint for the administrator main account.
- Detects test/live key mode without exposing the key.
- Fetches a selected store subaccount before saving payment routing.
- Displays only masked settlement account numbers.

### Arkesel

- Calls the v2 balance-details endpoint.
- Reports SMS and main balance without sending a message.
- Flags low SMS credit as attention.

### WhatsApp

- Never calls the send-message endpoint during health checks.
- Requires a separate HTTPS `WHATSAPP_HEALTH_URL`.
- Reports configured-but-unchecked when no read-only endpoint is available.

### S3 or R2 media

- Uses a read-only `HeadBucket` request.
- Flags local Railway storage as ephemeral.
- Does not write or delete an object.

### Reservation release scheduler

- Accepts authenticated `POST /api/jobs/release-reservations` requests.
- Uses `JOBS_API_TOKEN` or the legacy `JOB_SECRET` during migration.
- Records started, succeeded and failed heartbeats in the existing platform audit log.
- Flags missing, failed or stale heartbeats from `/admin/integrations`.

## Required production variables

```text
PAYSTACK_SECRET_KEY
PAYSTACK_PLATFORM_ACCOUNT_LABEL
ARKESEL_API_KEY
ARKESEL_SENDER_ID
WHATSAPP_API_TOKEN
WHATSAPP_HEALTH_URL
MEDIA_STORAGE_PROVIDER
MEDIA_PUBLIC_URL
S3_* or R2_*
JOBS_API_TOKEN
RESERVATION_JOB_INTERVAL_MINUTES
```

`JOBS_API_TOKEN` must be a separate random value of at least 32 characters.

## Safe rollout order

1. Confirm the Release #16 Railway deployment and independent 2FA encryption key.
2. Deploy Release #17 with provider features still disabled where credentials are incomplete.
3. Open `/admin/integrations` and resolve unreachable or unconfigured services.
4. Verify the ESM administrator Paystack account.
5. Verify each store's own Paystack subaccount from its admin shop page.
6. Configure the scheduler and confirm a successful heartbeat.
7. Perform controlled test transactions and delivery tests before broad customer use.
