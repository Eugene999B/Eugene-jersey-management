# CEO Settings and Platform Governance

Updated: 2026-07-28

## Purpose

This roadmap phase converts `/admin/settings` from a read-only environment summary into a database-backed CEO control centre.

Provider secrets remain protected in Railway. The page may show masked readiness but must never read, reveal or update Paystack, Arkesel, WhatsApp, storage, session or encryption secrets.

## Governance foundation

The singleton `PlatformGovernanceSettings` record stores public platform and legal identity, support contacts, country/currency/timezone defaults, terms/privacy versions, marketplace and sign-up policies, payment and messaging policies, maintenance/incident states, commercial defaults, security thresholds, retention periods and allowed upload MIME types.

## Audit rules

Every update requires a written reason and records previous value, new value, administrator identity, time, source IP and device user agent. Audit metadata must never contain provider secrets, passwords, sessions, two-factor secrets or complete settlement account details.

## Security boundary

`PlatformGovernanceSettings` is platform-global. Shop tenant clients and interactive tenant transactions must fail closed if they attempt direct access. Settings permission is required for the page and API.

## Scope boundary

This release establishes the governance source of truth and audited editing experience. Subscription plan catalogues, communication-credit pricing, second-administrator approvals and enforcement of every policy across all public routes remain focused follow-up work within the confirmed roadmap.
