# Communication Credits and Shop Wallets

Updated: 2026-07-28

## Purpose

Release #24 gives EJM controlled commercial ownership of SMS and WhatsApp credits while keeping every shop's balance and usage isolated.

This is not a shared tenant cash balance. It is a channel-specific allowance for outbound customer messages.

## Payment ownership

1. Communication-credit purchases use the EJM administrator Paystack integration configured by `PAYSTACK_SECRET_KEY`.
2. Credit purchases do not include a shop Paystack subaccount.
3. The complete package payment settles to the EJM administrator account.
4. Normal customer purchases from a shop remain unchanged: they still require that shop's verified Paystack subaccount and settlement destination.
5. The credit callback and webhook both verify the provider transaction before adding units.
6. Callback and webhook settlement are idempotent; the same purchase cannot credit a wallet twice.

## Authoritative package catalogue

1. SMS and WhatsApp packages are separate records.
2. Each package stores its code, channel, currency, price, paid units, bonus units, availability and version.
3. Migration placeholders contain no invented price or credit quantity and cannot be purchased.
4. A package shell may be created without commercial terms, but it remains inactive and private.
5. A Billing administrator submits a written package proposal.
6. The requester cannot approve their own proposal.
7. A different Billing administrator approves or rejects it with a decision note.
8. Approval fails closed when the package version changed after the proposal was submitted.
9. Every approved change creates an immutable package-version snapshot.
10. A pending purchase keeps the exact approved package version, price and unit quantity that the shop selected.

## Wallet isolation

1. Every shop has one SMS wallet and one WhatsApp wallet.
2. Existing shops start at zero in both wallets.
3. One shop can never spend, read or alter another shop's credits.
4. Package catalogue, approval, purchase, wallet and ledger models are blocked from the generic shop tenant client and interactive tenant transactions.
5. Shop pages access balances and purchases only through dedicated reviewed repositories that require an explicit `shopId`.
6. Wallet balance can never fall below zero.

## Message charging

1. One accepted outbound SMS consumes one SMS credit.
2. One accepted outbound WhatsApp message consumes one WhatsApp credit.
3. Email does not consume communication credits.
4. Console-mode SMS or WhatsApp queues do not consume credits.
5. Platform authentication and verification messages sent through direct platform helpers are not charged to a shop.
6. A real provider send reserves one credit atomically before dispatch.
7. When the provider rejects or times out, the reserved credit is refunded through an immutable ledger entry.
8. When a shop has no credit, the provider is not called and the customer message is recorded as failed with `INSUFFICIENT-CREDITS`.
9. Automatic POS receipt notifications never roll back a completed sale because messaging has insufficient credits.
10. The current unit is one outbound message. Provider segment pricing and template-specific costs remain part of later provider-cost reconciliation.

## Ledger rules

1. Every purchase, usage, refund or future administrator adjustment is an immutable ledger entry.
2. Every ledger entry records the channel, signed delta, resulting balance, reason and unique reference.
3. Message usage references are idempotent per `CustomerMessage`.
4. Provider-failure refunds are idempotent and require an existing usage entry.
5. Purchase ledger entries use a unique purchase reference and are created only after verified Paystack settlement.
6. Wallet updates and ledger creation run in serializable database transactions.
7. Lifetime purchased, used and refunded totals are maintained independently from the current balance.

## Shop workflow

1. Owners and managers open **Messages** to see SMS and WhatsApp balances.
2. Only owners and managers can initiate a package purchase.
3. Cashiers may send authorised customer messages but cannot purchase credits.
4. The shop selects an approved public package and continues to Paystack.
5. After verified payment, the selected channel wallet receives paid plus bonus units.
6. Purchase history and the credit ledger remain visible in the shop workspace.
7. Debt reminders blocked for insufficient credits do not increment the debt reminder counter.

## Administrator workflow

1. Open **Administrator → Communication credits**.
2. Create package shells when another size or campaign package is required.
3. Submit the real price, paid units, bonus units and availability as a proposal.
4. Sign in as a different administrator with Billing permission.
5. Approve or reject the proposal with a decision note.
6. Monitor wallet balances, verified package revenue and recent Paystack purchases.
7. Never edit a shop wallet directly outside a reviewed adjustment workflow with a ledger entry.

## Environment and rollout

Release #24 adds no new required environment variables.

It uses the existing variables:

- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_TIMEOUT_MS`
- `APP_URL`
- `SMS_PROVIDER`, Arkesel credentials, or generic SMS provider values
- `WHATSAPP_PROVIDER`, `WHATSAPP_API_URL`, and `WHATSAPP_API_TOKEN`

Before shops can purchase credits:

1. Configure and approve at least one package for the required channel.
2. Confirm the package is configured, active and public.
3. Confirm the EJM administrator Paystack integration is healthy.
4. Complete a controlled package purchase and verify that exactly one purchase ledger entry is created.
5. Complete controlled SMS and WhatsApp delivery tests before enabling broad paid messaging.
