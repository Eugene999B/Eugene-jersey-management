# Phase 12 — Guided Design Studio production workflow

## Purpose

Phase 12 connects saved Design Studio artwork to the physical garment-production workflow without replacing or weakening the proven drawing engine and direct-cutter safety system.

The workflow is available at:

`/dashboard/designs/workflow`

It follows the real operator sequence:

1. choose saved artwork;
2. choose the exact garment;
3. choose the exact garment size;
4. choose the print placement;
5. choose the real production material;
6. preview the placement on the garment;
7. verify artwork, placement, cut-sheet and material dimensions;
8. review the physical production recipe;
9. approve an immutable production snapshot;
10. continue to the existing controlled cutter queue.

## Explicit selection rule

Phase 12 does not silently pick the first size, placement or material for a new job.

The operator must explicitly choose:

- garment profile;
- garment size;
- placement template;
- material recipe.

Existing reviewed jobs reopen their previously reviewed selections so the operator can see exactly what was approved.

Changing a choice after review invalidates the local reviewed state and requires another production review.

## Saved-artwork measurements

The production review reads the authoritative saved Design Studio canvas.

It calculates:

- cut-sheet width and height;
- conservative visible-artwork bounding width and height;
- size-specific placement allowance where configured;
- default placement allowance when no size-specific rule exists;
- material roll width;
- material mirror rule.

Rotated artwork uses a conservative axis-aligned production bound, so rotation cannot make the fit check falsely optimistic.

## Blocking checks

Production review is blocked when:

- the selected size is not part of the garment profile;
- the placement belongs to another garment;
- the saved design has no visible artwork;
- the cut sheet is wider than the material roll;
- the visible artwork is larger than the selected placement allowance.

## Operator warnings

Warnings do not pretend to solve physical-production uncertainty automatically.

Examples include:

- material press temperature above the garment's configured safe heat limit;
- missing cutter blade/force/speed reference;
- use of a default placement size because no exact garment-size rule exists.

These conditions remain visible so the operator can test and approve the real process.

## Reviewed production snapshot

A reviewed production job is stored in `DesignProductionBrief`.

The record contains stable references plus snapshots of:

- garment profile;
- garment size;
- placement profile;
- material recipe;
- cut-sheet measurements;
- artwork measurements;
- placement allowance;
- material roll width;
- mirror requirement;
- reviewer and review time.

The snapshot is intentional: if an owner later changes a material recipe or garment profile, the historical reviewed job does not silently change underneath the operator.

## Cutter handoff

The final Phase 12 action does not write directly to a serial port.

It routes the reviewed saved design to the existing Phase 10 cutter operations page with that design selected. Cutter operations still independently requires:

- compatible active HPGL machine profile;
- supported Chrome/Edge Web Serial environment;
- material loading and alignment;
- blade and origin check;
- cutter-panel test cut;
- durable queue-job preparation;
- explicit final send confirmation.

This preserves defense in depth: passing the garment/fit review does not bypass the physical-machine checklist.

## Compatibility

- Existing Design Studio projects are unchanged.
- Existing saved artwork remains usable.
- Phase 10 cutter operations remains backward-compatible for older jobs.
- The new database table is additive and references existing DesignJob records without rewriting them.
- Existing Phase 11 production library data is reused directly.

## Verification

Phase 12 includes automated coverage for:

- cut-sheet measurement;
- visible artwork bounds;
- rotated artwork handling;
- size-specific placement rules;
- roll-width rejection;
- placement-fit rejection;
- heat-process warnings;
- exact production-selection fingerprinting;
- additive migration safety;
- tenant-scoped and origin-checked API writes;
- immutable production snapshots;
- audit logging;
- Design Studio → guided production → reviewed cutter handoff in Chromium.
