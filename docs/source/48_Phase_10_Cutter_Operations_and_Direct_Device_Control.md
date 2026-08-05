# Phase 10 — Cutter Operations and Direct Device Control

## Purpose

Phase 10 turns Design Studio's existing direct HPGL serial output into a durable, human-operated production workflow for a roll-fed vinyl cutter or plotter.

The equipment photographs previously supplied show the working class of equipment:

- A roll-fed cutter or plotter with its own control panel
- Heat-transfer vinyl and carrier sheets
- A manual heat press
- Garments receiving the finished transfer

The photographs do not provide a verified manufacturer label, model number or command manual. The system therefore keeps protocol claims honest:

- A compatible HPGL/PLT cutter can receive validated paths directly through Chrome or Edge Web Serial.
- Printers continue through the operating-system print dialog or their RIP software.
- A cutter that requires a proprietary driver or command language continues through vendor software until its exact model and protocol are confirmed.

## What is direct

For an active machine profile configured as:

- Output format: HPGL
- Connection route: Direct browser serial connection

Chrome or Edge asks the operator to choose a local serial port. The browser then:

1. Opens the port at the profile's baud rate.
2. Checks the detected USB vendor and product identifiers when they are configured.
3. Claims one prepared queue job from the server.
4. Writes only the server-approved HPGL payload.
5. Records the result and physical-device snapshot.

The server cannot silently open local hardware. Every connection and final send requires an operator gesture in the browser on the computer physically connected to the cutter.

## Saved artwork only

Unsaved canvas state cannot enter machine operations.

The operator must first save the Design Studio project. Machine operations then load the saved shop record and use the existing production engine to:

- Validate the production area.
- Convert rectangles, circles and vector artwork to cutter paths.
- Convert editable text to closed outlines in the browser.
- Reject unsupported or out-of-bounds artwork.
- Apply the saved weed box and registration-mark settings.
- Apply the selected mirror setting and configured origin.
- Generate the exact HPGL payload.

There is no raw-command text box. Staff cannot paste arbitrary serial commands into the production screen.

## Physical operator sequence

### 1. Choose saved artwork and cutter

Select:

- The saved Design Studio project
- The active direct HPGL cutter profile

The profile must identify the real bed, origin, units per millimetre and baud rate. USB vendor and product identifiers should be recorded when available.

### 2. Load material

Record the actual roll or sheet width in millimetres.

The system blocks preparation when:

- The material width is invalid.
- The material is narrower than the saved production area.
- The production area exceeds the cutter profile.

### 3. Complete physical checks

The operator confirms all six items:

- Material is straight and covers the production width.
- Pinch rollers are locked on the grit rollers.
- Blade depth, holder and pressure match the material.
- Machine origin is set at the intended start point.
- Carriage path, roll feed and floor area are clear.
- The cutter's own panel test cut was weeded and passed.

The browser does not move the cutter during the checklist. The cutter-panel test function remains authoritative for blade depth and pressure.

### 4. Connect the exact device

Use current Chrome or Edge on the Windows computer physically connected to the cutter.

The browser port chooser is filtered by the configured USB identity when available. If the detected identity does not match, the port is closed and production is blocked.

### 5. Prepare the queue job

Preparation stores:

- Shop and saved design
- Machine profile
- Job and material details
- Material and production dimensions
- Mirror and origin
- Path count and byte length
- SHA-256 payload hash
- Completed physical checklist
- Production warnings
- Exact HPGL payload
- Preparing operator and timestamp

The queue job starts as `PREPARED`.

### 6. Send once

Before transmission, the operator sees an explicit warning that serial bytes cannot be recalled after blade movement begins.

The server atomically changes the job:

- `PREPARED` or `FAILED` → `SENDING`

Only one browser session can claim the job. The claimed profile, baud rate and USB identity are checked again before the browser writes the bytes.

The outcome becomes:

- `SENT` when the write succeeds and the result is recorded.
- `FAILED` when the write fails and the error is recorded.

Every attempt is append-only.

## Duplicate protection

The server hashes the exact payload together with the machine profile, origin and mirror setting.

If the same payload was sent to the same machine within the last 15 minutes, normal preparation is blocked. The operator must inspect the previous cut and use the clearly labelled intentional-resend action.

This protects against double-clicks, refreshes and repeated production of the same physical path.

## Uncertain send recovery

A network failure can happen after the browser writes bytes but before it records the result.

Such a job remains `SENDING`. It is not automatically retried because the cutter may already have moved.

After physically inspecting the cutter and material, an operator can explicitly record:

- Physically sent
- Not sent / failed

The interface warns against resending until the uncertain record is resolved.

## Cancellation truth

Only `PREPARED` and `FAILED` jobs can be cancelled.

A `SENT` job is an immutable production record. The browser never claims that it can recall physical blade movement.

## Tenant and permission safety

- Every unrestricted queue query requires `shopId`.
- The saved design, machine profile and operator must belong to the same shop.
- The machine profile must be active, HPGL and direct Web Serial.
- Existing Design Studio role permission controls remain authoritative.
- Queue preparation, claim, send, failure, resolution and cancellation are written to the audit log.

## Additive data model

Phase 10 adds only:

- `MachineProductionJob`
- `MachineProductionAttempt`

It does not rewrite or delete:

- Design jobs or immutable design versions
- Orders or workflow records
- Payments, debts or refunds
- Inventory or stock movements
- Machine profiles

## Current hardware boundary

The direct route is production-ready for cutters that genuinely accept the generated HPGL/PLT stream over a browser-accessible serial port.

Before using a real machine, an owner or manager must confirm from the machine label/manual or current working software:

- Manufacturer and model
- Supported command language
- Correct baud rate and serial settings
- USB vendor/product identifiers or Windows COM-port identity
- Bed or roll width
- Origin convention
- Whether hardware flow control or a vendor driver is required

A proprietary or driver-only cutter must not be falsely labelled direct HPGL. Its future adapter belongs in a local Windows device bridge after the exact protocol is known.

## Verification

Permanent validation includes:

- Additive migration checks
- Physical-checklist tests
- Material and bed overflow tests
- Raw-query tenant-scope guards
- One-claim state transition checks
- Duplicate-send window checks
- Saved-design and direct-profile API guards
- Arbitrary-command-input exclusion
- Client/server bundle separation
- A Chromium journey that saves artwork, configures a cutter, verifies USB filters and baud rate, prepares a durable job, writes HPGL bytes, records `SENT` and proves duplicate blocking
- Full migration, lint, TypeScript, unit, tenant-isolation, documentation, production-build and browser validation before merge
