# Phase 13 — Manual heat-press execution and quality control

## Purpose

Phase 13 executes the physical heat-press portion of a reviewed production job without pretending the photographed manual press is electronically controlled.

The operator workspace is:

`/dashboard/designs/heat-press`

A reviewed Phase 12 production brief is the required source of truth. That means the heat-press operator receives the same frozen garment, exact size, placement and material recipe that was approved before cutting.

## Physical workflow

1. Open a reviewed production job.
2. Confirm material, garment, size, placement and warnings.
3. Create a durable press attempt when the physical garment and transfer are ready.
4. Verify temperature and pressure manually on the press.
5. Start the first-press timer.
6. Pause, resume or reset when necessary.
7. Mark the first press complete.
8. Follow and record the saved peel method.
9. Run the optional repress timer when the material recipe requires it.
10. Inspect the finished garment using all required quality checks.
11. Pass quality or record a rework reason.
12. Attach finished-product photo evidence when useful.
13. Return to the order workflow after quality passes.

## Manual-machine truthfulness

ESM may:

- display the material recipe;
- display temperature, time, pressure and peel guidance;
- recover a timer after page reload;
- record actual elapsed press/repress time;
- record the operator and production event history;
- record quality results and rework;
- store finished-product evidence.

ESM does **not** claim that it can:

- set the manual press temperature electronically;
- adjust physical pressure;
- close or open the clamshell;
- peel the carrier;
- determine quality without operator inspection.

The operator remains responsible for the physical press and safety procedure.

## Durable timer design

The timer is not only browser state.

`HeatPressRun` stores:

- timer mode (`FIRST_PRESS` or `REPRESS`);
- server timestamp when a timer started;
- elapsed milliseconds already accumulated before a pause;
- actual first-press duration;
- actual repress duration.

The UI reconstructs elapsed time from the stored timestamp. Reloading the page or reopening the workflow therefore does not silently reset an active timer.

Pause stores the accumulated time. Resume starts from that saved value. Reset is an explicit audited action.

## State machine

Heat-press attempts use explicit server-enforced states:

- `READY`
- `PRESSING`
- `PAUSED`
- `FIRST_PRESS_COMPLETE`
- `PEEL_COMPLETE`
- `REPRESSING`
- `QUALITY_CHECK`
- `PASSED`
- `REWORK_REQUIRED`

The API rejects impossible transitions such as:

- peeling before the first press;
- completing a repress before its timer starts;
- approving quality before pressing is complete;
- passing quality with an incomplete checklist;
- changing a closed passed/rework attempt.

## Quality checklist

Every successful garment must confirm:

- design centred and correctly positioned;
- correct garment size;
- correct garment/material colour;
- no lifted vinyl edges;
- no scorch or heat marks;
- no vinyl cracking, melting or damage;
- carrier removed using the correct peel method;
- customer instructions and placement satisfied.

Quality cannot be marked passed until every check is true.

If one or more checks fail, the operator records a rework reason. The failed attempt remains immutable in history and a new numbered attempt is created for the rework. The new attempt gets its own timers, QC and evidence.

## Finished-product photo evidence

Photo evidence is stored durably in PostgreSQL so it does not depend on Railway's local filesystem.

Rules:

- JPEG, PNG or WebP only;
- maximum 5 MB per image;
- maximum 6 images per heat-press attempt;
- SHA-256 hash recorded for each image;
- tenant-scoped upload and retrieval;
- authenticated Design/Production role required;
- evidence responses are private/no-store and use `X-Content-Type-Options: nosniff`.

The photo bytes are stored in PostgreSQL `BYTEA`, with metadata in `HeatPressEvidence`.

## Audit and history

`HeatPressEvent` records important execution events such as:

- attempt creation;
- timer start/pause/reset;
- first press complete;
- peel complete;
- repress start/complete;
- quality pass;
- rework required;
- photo attached.

The normal platform audit trail also records heat-press mutations.

## Cutter and order relationship

The cutter screen now links reviewed jobs to Heat press with explicit wording:

**After cutting & weeding: Heat press**

Phase 13 intentionally does not fake an electronic weeding step. The physical operator completes cutting/weeding before opening the press workflow.

After a garment passes quality, the page can return to the linked order workflow. Phase 13 does not silently invent or force an order-status transition; order status remains governed by the existing Phase 9 workflow controls.

## Data compatibility

Phase 13 is additive:

- existing orders are not rewritten;
- existing Design Studio artwork is not rewritten;
- Phase 12 production briefs are not rewritten;
- Phase 10 cutter jobs remain unchanged;
- Phase 11 production recipes remain unchanged.

New tables are:

- `HeatPressRun`
- `HeatPressEvent`
- `HeatPressEvidence`

## Verification

Automated coverage checks:

- recipe extraction from reviewed snapshots;
- durable timer recovery;
- complete QC enforcement;
- allowed evidence file types and size limit;
- additive migration safety;
- tenant and origin enforcement;
- server state transitions;
- hashed private evidence handling;
- explicit manual-machine wording;
- Chromium operator journey from reviewed job through first press, pause/resume, peel, repress, photo evidence and quality pass.
