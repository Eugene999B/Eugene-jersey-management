# Release #19 — Design Studio Grouping and Version History

Updated: 2026-07-27

## Purpose

Release #19 makes complex production artwork safer to edit and easier to recover. Operators can select multiple layers, group related elements, move them without losing spacing, and reopen immutable shop-saved versions.

This release does not change Paystack, Arkesel, WhatsApp, store settlement, account roles, two-factor authentication or production provider credentials.

## Multi-select workflow

1. Clicking one ungrouped layer selects that layer.
2. Clicking any member of an existing group selects the complete group.
3. Holding **Shift**, **Ctrl** or **Command** adds or removes a layer or group from the current selection.
4. Dragging a selected member moves every unlocked selected layer together.
5. Keyboard arrow movement also applies to the current unlocked selection.
6. The movement helper clamps the whole selection to the production sheet so one layer does not escape while the other layers continue moving.
7. Locked layers remain fixed until explicitly unlocked.

The selection panel provides:

- **Group selected**;
- **Ungroup selected**;
- **Duplicate selected**;
- **Delete selected**; and
- **Clear selection**.

## Group persistence

The current Design Studio project schema is version `5`.

Each layer may contain an optional `groupId`. This value is retained in:

- the authoritative `DesignJob.canvasJson` record;
- immutable `DesignJobVersion` snapshots;
- browser recovery drafts;
- downloaded `.design.json` backups; and
- reopened historical versions.

Projects created by versions 1–4 remain supported. Missing group metadata simply means the older layers are ungrouped. Projects created by a future unsupported version remain rejected rather than partially loaded.

## Immutable database history

Every successful shop save creates a new immutable `DesignJobVersion` record.

- A newly created project starts at version 1 with source `CREATE`.
- A project saved before Release #19 receives version 1 as an imported baseline before the changed project is stored as version 2.
- Later saves increment the version number inside a serializable database transaction.
- Safe transaction conflicts are retried once.
- A persistent simultaneous-save conflict returns an instruction to reload and save again rather than overwriting another operator's work.
- Historical snapshots are never updated or deleted through the Design Studio interface.

The version-history panel displays the latest 20 versions, the source, the responsible staff member when available, and the creation time.

## Opening an older version

Opening a historical version copies that snapshot into the editor as a working project. It does **not** change the current `DesignJob` database record.

The operator must review the historical artwork and explicitly press **Save changes** to make it the new current version. That save creates another immutable snapshot; it does not modify or remove the older version.

This rule prevents accidental rollback and preserves an auditable production sequence.

## Shop isolation

`DesignJobVersion` includes `shopId` and `designJobId` on every record. Database foreign keys enforce ownership and cleanup:

- deleting a shop removes its design history;
- deleting a design project removes its versions; and
- deleting a staff account leaves the version while clearing the optional creator reference.

The generic tenant Prisma client and tenant interactive transactions deliberately deny the `DesignJobVersion` delegate. Version history is read only through the dedicated API, which first verifies the requested `DesignJob` belongs to the authenticated shop and repeats the shop filter on every version query.

The permanent two-shop isolation script checks both normal tenant access and interactive-transaction access are rejected.

## Recovery and authority

Release #18 recovery rules remain unchanged:

- `DesignJob` is the authoritative shared current project;
- `DesignJobVersion` is the immutable authoritative save history;
- browser recovery is a temporary shop-worker-scoped interruption safety net;
- a recovery draft never silently overwrites the database; and
- successful shop saves clear the browser recovery draft.

## Production-output compatibility

Grouping changes editor selection only. Production output continues to render each layer with its existing coordinates, dimensions and rotation.

The following remain supported:

- SVG export;
- operating-system printing;
- production manifests;
- artwork uploads;
- HPGL rectangle/circle output; and
- compatible serial cutter connections.

## Validation coverage

Release #19 adds automated checks for:

- grouped selection and modifier-key toggling;
- group and ungroup behavior;
- whole-selection movement and sheet clamping;
- locked-layer movement rules;
- version-number validation and labels;
- project version 5 group persistence;
- denial of version-history access through normal and interactive tenant clients;
- browser grouping, version 1 save, version 2 save and version 1 reopen; and
- 390 × 844 Design Studio horizontal-overflow protection.

The full repository validation suite still covers dependency safety, Prisma migrations, lifecycle guards, TypeScript, unit tests, tenant isolation, production build and all existing desktop/mobile journeys.

## Remaining Design Studio programme

Separate future work includes:

- richer transform and resize handles;
- a dedicated mobile inspector;
- per-shop machine profiles;
- true SVG text and shape conversion to cut paths;
- DXF export and fuller HPGL interoperability;
- version comparison, labels and retention administration; and
- shared live collaboration or edit-locking for simultaneous operators.
