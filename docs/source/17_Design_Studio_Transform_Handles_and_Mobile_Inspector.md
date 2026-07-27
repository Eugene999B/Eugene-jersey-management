# Release #20 — Design Studio Transform Handles and Mobile Inspector

Updated: 2026-07-27

## Purpose

Release #20 makes exact artwork adjustment practical directly on the production sheet. It adds visible resize and rotation handles for one unlocked layer and gives phone and tablet operators a dedicated inspector without duplicating the editing rules.

This release does not change Paystack, Arkesel, WhatsApp, store settlement, account roles, two-factor authentication or provider credentials.

## Canvas transform rules

1. Transform handles appear only when exactly one unlocked visible layer is selected.
2. Four corner handles resize the selected layer.
3. The round handle above the layer rotates it around its centre.
4. Image and text resizing preserves their existing proportions.
5. Holding **Shift** while resizing a rectangle or circle preserves its proportions.
6. Holding **Shift** while rotating snaps the angle to 15-degree steps.
7. Resize and rotation remain inside the real production sheet through the same rotated-boundary clamping used by production validation.
8. Starting a transform creates one undo checkpoint; pointer movement does not create hundreds of undo entries.
9. Locked layers do not expose transform handles.
10. Multi-selection and grouped layers keep the existing shared movement workflow. Release #20 does not silently distort a group as one bounding box.

## Exact properties

The existing millimetre property controls remain authoritative for:

- X and Y position;
- width and height;
- rotation;
- text content and font;
- layer name; and
- non-image colour.

Canvas handles update those same layer values. Saving, recovery drafts, backups and immutable history therefore need no new project schema or migration.

## Mobile inspector

Phone and tablet layouts expose an **Inspector** action in the material-workspace toolbar.

The action opens a fixed bottom-sheet dialog containing the same selection and exact layer controls used on desktop. It is not a separate editing implementation.

Mobile behaviour:

- the background is dimmed;
- background scrolling is locked while the inspector is open;
- the inspector closes from its Close action, the backdrop or the Escape key;
- material, device and production-output panels remain available in the normal page flow; and
- the 390 × 844 layout must not create horizontal overflow.

## Safety boundaries

- Transform geometry is implemented in a pure tested helper.
- Rotation is normalised to a stable degree range.
- Minimum dimensions prevent inverted or zero-sized layers.
- The opposite corner remains anchored during ordinary corner resizing unless sheet clamping is required.
- The database `DesignJob` and immutable `DesignJobVersion` history remain unchanged.
- Browser recovery continues to write only while the project differs from the last authoritative shop save.
- Group selection, shop isolation and version-history rules from Releases #18 and #19 remain unchanged.

## Validation coverage

Release #20 adds automated checks for:

- rotated handle coordinates;
- opposite-corner resize anchoring;
- proportional resizing;
- sheet clamping;
- free and 15-degree snapped rotation;
- desktop handle visibility and pointer transforms;
- mobile inspector opening and exact property editing; and
- mobile overflow protection.

The complete repository suite must also pass dependency checks, Prisma validation, lifecycle guards, lint, TypeScript, unit tests, tenant-isolation attacks, production build and every existing desktop/mobile browser journey.

## Remaining Design Studio programme

Future separate releases include:

- multi-layer bounding-box scaling and rotation with explicit operator consent;
- per-shop machine profiles;
- true SVG text and artwork conversion to cut paths;
- DXF export and fuller HPGL interoperability;
- version comparison and labels; and
- simultaneous-edit protection or live collaboration.
