# Phase 11 — Production materials, garments and heat-press rules

## Purpose

Phase 11 turns the free-text production notes introduced during onboarding into a reusable shop-specific production reference. The goal is to make cutting and pressing repeatable for real operators without pretending that a manual heat press is computer-controlled.

The new workspace is available at:

`/dashboard/designs/materials`

It is linked directly from Design Studio and cutter operations.

## Structured production library

The shop keeps four groups of production rules:

1. **Heat press profile** — physical plate size, operating temperature range, pressure-control method, timer-control method and operator notes.
2. **Material recipes** — material identity, colour, roll width, remaining length, cost per metre, blade/profile, cutter force, cutter speed, passes, mirroring, press temperature, duration, pressure, peel method, repress time, compatible fabrics and warnings.
3. **Garment profiles** — garment type, colour, fabric, available sizes, cost, selling price, supplier, maximum safe press temperature and heat restrictions.
4. **Placement templates** — print location, default dimensions and optional size-specific dimensions such as `S: 90x90`, `M: 100x100` and `L: 110x110`.

## Data compatibility

Phase 11 deliberately keeps the existing `Shop.productionSetup` JSON field rather than replacing it or rewriting existing businesses.

The structured library is added under a versioned `library` object. Existing fields such as cutter name, connection notes, material notes, garment notes, artwork-size notes, production stages and deposit configuration remain untouched.

Resources have stable IDs. An owner or manager can archive and reactivate a material, garment or placement instead of deleting its identity. This allows later production and costing phases to reference the same shop-defined rule safely.

## Roles and audit trail

- Owners and managers can configure production rules.
- Designers can read the production reference but cannot change shop settings.
- Every configuration mutation is authenticated against the current shop and written to the normal audit trail.
- Production library writes update only the authenticated shop.

## Heat-press truthfulness

The photographed heat press is treated as a manual machine.

ESM may:

- show the correct material recipe;
- show temperature, time, pressure and peel instructions;
- show garment heat restrictions;
- provide operator checklists and timers in later workflow phases;
- record who performed each production step.

ESM does **not** claim that it can set the temperature, pressure or clamp of a manual press electronically.

If a material recipe conflicts with the garment's safe heat limit, the operator must validate a safer real-world process before production rather than blindly following the material default.

## Cutter relationship

Phase 10 already provides controlled direct HPGL/Web Serial cutter communication. Phase 11 gives that production flow a reliable shop-owned source for:

- actual material width;
- cutter blade/profile;
- cutter force;
- cutter speed;
- number of passes;
- whether the material must be mirrored;
- downstream press instructions.

The current cutter console remains backward-compatible with its manual material selector. A later Design Studio workflow phase can make the structured recipe the required explicit production selection without breaking existing saved jobs.

## Verification

Phase 11 includes unit/architecture coverage for:

- legacy production-setup preservation;
- structured recipe normalization;
- stable resource IDs;
- archive/reactivate behavior;
- owner/manager authorization;
- audit-backed writes;
- Design Studio and cutter-operation navigation.

Chromium acceptance creates a real manual heat-press profile, material recipe, garment profile and placement template, verifies the saved production values, and confirms that cutter operations can see the verified production-library state.
