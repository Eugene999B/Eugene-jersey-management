# Release #21 — Shop Machine Profiles and Cut-Path Export

Updated: 2026-07-27

## Purpose

Release #21 replaces generic shared cutter labels with shop-owned production profiles and adds fail-closed vector cut-path conversion for SVG, HPGL/PLT and DXF output.

No payment, messaging, account, settlement or two-factor configuration is changed by this release.

## Shop ownership rules

1. Every machine profile belongs to one exact shop.
2. Owners and managers may create, edit, deactivate, default or delete profiles.
3. Designers may select and use active profiles but cannot alter shop machine settings.
4. Each shop must retain at least one profile and one default profile.
5. A default generic SVG cutter profile is created for existing shops and lazily created for new shops when Design Studio is first opened.
6. Machine profile reads and writes must always include the authenticated `shopId`.
7. The tenant proxy and interactive tenant transactions must reject cross-shop machine-profile access.
8. Deleting or editing a profile never rewrites existing `DesignJobVersion` snapshots.

## Profile fields

A machine profile records:

- shop-owned name
- preferred output format: cut-path SVG, HPGL/PLT, DXF or Print/RIP
- bed width and height in millimetres
- plotter units per millimetre
- serial baud rate
- top-left or bottom-left origin
- default mirror behaviour
- default and active state

## Saved project rule

Design project format version 6 stores both:

- the selected machine profile ID and name
- a complete machine-settings snapshot

The server resolves the profile inside the authenticated shop and overwrites the client snapshot with authoritative database values before saving. A profile from another shop, a missing profile or an inactive profile is rejected.

The database `DesignJob` remains the current authoritative project. Every successful save continues to create an immutable `DesignJobVersion` containing the exact machine snapshot used for that save.

## Cut-path conversion rules

### Supported directly

- native Design Studio rectangles
- native Design Studio circles and ellipses
- embedded SVG paths using line, cubic, quadratic and elliptical-arc commands
- embedded SVG rectangles, circles, ellipses, lines, polylines and polygons
- nested SVG groups with translate, scale, rotate, skew and matrix transforms

Curves and arcs are flattened into sufficiently dense polylines before HPGL or DXF output.

### Fail closed

Direct cutter export stops when artwork contains:

- live Design Studio text
- raster images
- externally linked artwork
- embedded SVG text, image, use or foreign-object elements
- unsupported or malformed SVG geometry
- paths outside the production sheet

The operator must convert live text to outlines and trace raster artwork in a vector tool before cutter export. The system never pretends those objects are cutter-ready.

### Output formats

- **Cut-path SVG** contains only path polylines with no raster images or live text.
- **HPGL/PLT** uses the selected shop profile's units per millimetre, origin and mirror setting.
- **DXF** uses millimetre units and lightweight polylines.
- **Print/RIP** preserves the existing full-colour SVG and operating-system print workflow.

Registration marks remain print-alignment marks and are not silently added to cutter paths. The weed box may be included as a cut path.

## Production safety

1. Review cut-path errors and warnings before downloading or sending a job.
2. Confirm machine bed dimensions and use the profile's “Use machine bed” action when appropriate.
3. Confirm material loading, blade depth, origin and mirror behaviour with a small test cut.
4. Direct serial sending remains available only for a connected writable browser serial port.
5. The selected shop profile's baud rate and HPGL units are used for serial jobs.
6. Multiple copies must be arranged as separate artwork before cutter export; repeatedly cutting one path can damage the material.
7. Never leave a cutter unattended after sending a new profile or unfamiliar path.

## Validation requirements

- Prisma schema generation and migration deployment
- tenant isolation for normal and interactive clients
- profile API role and shop filters
- version 6 project migration and machine snapshot preservation
- vector path parsing, transforms, curves, arcs, mirroring and origins
- lint-safe deterministic parser iteration
- SVG, HPGL and DXF output structure
- fail-closed text/raster handling
- production build
- owner/manager profile management browser journey
- designer read-only profile selection browser journey
- cut export browser journey
- existing recovery, history, grouping, transforms, mobile inspector and full platform journeys
