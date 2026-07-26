# Patch notes — 2026-07-25

## Context
Grok full-system review of Eugene-jersey-management + Google Drive docs.

## Code changes (this pack)
- payments: mark FAILED on amount/currency mismatch; export amountToSubunit
- proxy: x-pathname header
- dashboard layout: server-side canAccessDashboardPath assert
- tests: payments + dashboard-access

## Docs
- refreshed docs/source/10_System_Diagnostic_Progress_and_Roadmap.md

## Blocked
GitHub connector lacked write permission (403). User must reconnect with Contents write or copy files from this pack manually.

## Manual ops
Rotate demo credentials; admin:bootstrap; schedule reservation job; live Paystack/Arkesel keys.
