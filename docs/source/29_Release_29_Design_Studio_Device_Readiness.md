# Release #29 — Design Studio Device Readiness

Updated: 2026-07-28

## Purpose

This release hardens Design Studio for the first customer presentation and for real production-device setup.

The studio explains and validates the exact route used by each machine:

- operating-system printing for installed printers;
- full-colour file export for RIP-managed printers;
- SVG, DXF or PLT cut-file export for vendor software;
- direct browser serial communication only for compatible HPGL/PLT cutters.

An ordinary web page cannot truthfully enumerate every printer installed on a computer or implement every manufacturer-specific protocol. The application therefore records the configured machine identity, shows browser-visible hardware identifiers when available, validates profile compatibility, and never claims direct communication where only an operating-system or vendor-software workflow exists.

## Delivered scope

1. Shop machine profiles now record manufacturer, model, device category and connection/production route.
2. Existing bed size, origin, mirror, plotter units and serial baud settings remain shop-owned and validated.
3. Profiles may store optional USB vendor and product identifiers for serial-device matching.
4. Device Readiness separates the configured machine identity from hardware information exposed by the browser.
5. Serial preflight filters selection by configured USB identifiers when supplied.
6. Serial preflight opens the chosen port, checks hardware identity and writability, then closes it without sending movement commands.
7. The existing production sender remains limited to validated HPGL vector paths on a connected writable serial port.
8. All new identity and route settings are included in authoritative saved-project and immutable-version machine snapshots.
9. Permanent unit, architecture and browser tests cover both direct HPGL cutting and DTF/RIP printer workflows.

## Production routes

### Operating-system print

The studio opens the normal browser/operating-system print dialog. The installed printer driver controls the selected physical printer, paper or media, colour and quality settings. The web page does not pretend that it can enumerate every installed printer.

### RIP-managed printer

DTF, sublimation, UV and large-format printers can use the full-colour SVG export in their normal RIP software. The RIP remains responsible for ink channels, colour profiles, nesting, media and curing settings.

### Vendor-file cutter workflow

SVG, DXF and PLT outputs can be opened in the software supplied for the cutter or plotter. This route supports machines whose vendor driver or protocol is not safely available to the browser.

### Direct serial HPGL

A compatible cutter can use Web Serial in current Chrome or Edge over a secure origin. The user approves the port, and only checked HPGL vector paths may be sent. Optional USB VID/PID values make the no-movement preflight more specific.

## Safety boundary

- Standard printers remain controlled by the operating-system print dialog and installed drivers.
- RIP, DTF, sublimation, UV and large-format printers receive files through their normal print/RIP workflow.
- SVG, DXF and PLT cutters continue through vendor software unless the machine exposes a compatible HPGL serial port.
- Direct browser sending is limited to a connected writable Web Serial port and an HPGL machine profile.
- A successful serial write confirms that the browser handed bytes to the port; the operator must still confirm machine movement, origin, media loading and output quality.
- New or unfamiliar equipment must use a small test job before production.

## Validation gates

- ordered Prisma migration;
- profile API validation and tenant isolation;
- machine snapshot preservation in shop saves and immutable versions;
- device-route and hardware-match unit tests;
- lint and TypeScript;
- complete unit suite;
- production build;
- owner profile-management browser journey;
- mocked serial preflight, connection and HPGL-send browser journey;
- DTF/system-print and full-colour RIP-export browser journey;
- existing Design Studio recovery, history, grouping, transforms, cut export and mobile journeys.
