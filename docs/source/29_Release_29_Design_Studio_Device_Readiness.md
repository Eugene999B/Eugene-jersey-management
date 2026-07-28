# Release #29 — Design Studio Device Readiness

Updated: 2026-07-28

## Purpose

This release hardens Design Studio for the first customer presentation and for real production-device setup.

The studio must explain and validate the exact route used by each machine:

- operating-system printing for installed printers;
- full-colour file export for RIP-managed printers;
- SVG or DXF cut-file export for vendor software;
- direct browser serial communication only for compatible HPGL/PLT cutters.

An ordinary web page cannot truthfully enumerate every printer installed on a computer or implement every manufacturer-specific protocol. The application therefore records the configured machine identity, shows the browser-visible hardware identifiers when available, validates profile compatibility, and never claims direct communication where only an operating-system or vendor-software workflow exists.

## Delivery scope

1. Expand shop machine profiles with manufacturer, model, device category and connection method.
2. Store complete serial settings: baud rate, data bits, stop bits, parity and flow control.
3. Allow optional USB vendor and product identifiers for profile-to-device matching.
4. Show configured identity, detected identity, browser capability and production route in Device Readiness.
5. Filter serial selection by configured USB identifiers when supplied.
6. Reject direct sending when the detected device conflicts with the selected profile.
7. Send large HPGL jobs in controlled chunks with visible progress.
8. Preserve all new settings in saved-project and immutable-version snapshots.
9. Add permanent architecture, unit and browser presentation tests.

## Safety boundary

- Standard printers remain controlled by the operating-system print dialog and installed drivers.
- RIP, DTF, sublimation, UV and large-format printers may receive the full-colour SVG through their normal RIP workflow.
- SVG and DXF cutters continue through vendor software unless the machine exposes a compatible HPGL serial port.
- Direct browser sending is limited to a connected writable Web Serial port and a compatible HPGL machine profile.
- A successful serial write confirms that the browser handed bytes to the port; the operator must still confirm machine movement, origin, media loading and output quality.
- New or unfamiliar equipment must use a small test job before production.

## Validation gates

- ordered Prisma migration;
- profile API validation and tenant isolation;
- project-version migration and snapshot preservation;
- device-route and hardware-match unit tests;
- chunked serial-write tests;
- lint and TypeScript;
- complete unit suite;
- production build;
- owner profile-management browser journey;
- mocked serial connection and HPGL-send browser journey;
- standard printer/RIP workflow browser journey;
- existing Design Studio recovery, history, grouping, transforms, export and mobile journeys.
