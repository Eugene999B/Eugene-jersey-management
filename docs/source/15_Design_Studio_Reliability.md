# Release #18 — Design Studio Reliability

Updated: 2026-07-27

## Purpose

Release #18 protects design operators from losing unsaved work after an accidental refresh, browser crash, closed tab or temporary network failure. It adds versioned project loading and a browser-local recovery draft while keeping the shop database save as the authoritative project record.

This release does not change Paystack, Arkesel, WhatsApp, tenant roles, payment settlement or production credentials.

## Recovery workflow

1. The Design Studio prepares project data using the current project schema version.
2. Meaningful unsaved work is copied to browser storage after a short delay.
3. A final best-effort copy is written when the page is hidden or closed.
4. Recovery storage is scoped to the exact shop and worker account.
5. After a reload, the studio compares the recovery timestamp with the matching saved shop project.
6. A stale recovery draft is deleted when the shop database copy is newer.
7. A newer recovery draft is never opened silently. The operator must choose **Restore recovered draft** or **Discard**.
8. A successful shop save removes the local recovery draft.

## Authority and isolation

- The database `DesignJob` remains the authoritative shared shop copy.
- Browser recovery is a temporary safety net on one browser profile and device.
- Recovery does not sync between computers or browsers.
- Recovery storage does not contain account passwords, sessions, payment keys or provider credentials.
- The storage key is derived from the current shop ID and worker ID so one shop worker does not receive another worker's recovery prompt.
- Opening a shop project, backup or recovery still passes through project validation and layer normalisation.

## Versioned project data

The current Design Studio project version is `4`.

Older supported projects are migrated in memory by filling safe defaults for:

- copies;
- grid display;
- snap-to-grid;
- weed box;
- registration marks;
- contour offset; and
- machine profile.

The studio rejects:

- malformed project objects;
- projects without a layer array;
- invalid version numbers; and
- projects created by a future unsupported studio version.

Rejecting future versions prevents an older deployment from silently removing settings it does not understand.

## Storage safeguards

- Maximum recovery draft size: 1,800,000 bytes.
- Maximum recovery age: 14 days.
- Future timestamps beyond a small clock-skew allowance are rejected.
- Corrupt, expired or oversized recovery data is ignored and cleared where possible.
- When browser storage is full or the project exceeds the recovery limit, the studio tells the operator to download a backup before leaving.

The server-side `/api/designs` project limit remains 2,000,000 serialized characters.

## Operator guidance

1. Use **Save project** or **Save changes** for the shared shop record.
2. Treat the local recovery message as protection against interruption, not confirmation of a database save.
3. Download a `.design.json` backup before major production changes or when the recovery-size warning appears.
4. After restoring work, review material, dimensions, mirror state, registration marks, copies and machine workflow before production.
5. Never assume a local recovery draft is available on another device.

## Validation coverage

Release #18 adds automated coverage for:

- migration from older project data;
- rejection of unsupported future versions;
- recovery serialization and restoration;
- corrupt, expired and oversized draft rejection;
- shop-worker-scoped storage keys;
- newer-versus-stale recovery decisions;
- browser edit, autosave, reload and restore; and
- mobile horizontal-overflow protection.

Existing production checks continue to cover save, reload, SVG, print, HPGL, selection, movement, mirror behaviour and tenant isolation.

## Remaining Design Studio programme

The following remain separate future work:

- multi-select;
- group and ungroup;
- version history stored in the database;
- richer transform handles and mobile inspector;
- per-shop machine profiles;
- true SVG text/shape conversion to production cut paths;
- DXF and fuller HPGL interoperability; and
- automated recovery for artwork that cannot fit safely in browser storage.
