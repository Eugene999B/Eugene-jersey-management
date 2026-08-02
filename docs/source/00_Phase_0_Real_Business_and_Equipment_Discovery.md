# Phase 0 — Real Business and Equipment Discovery

## Purpose

This document is the authoritative starting point for rebuilding Eugene Shop Management around the real shop process rather than assumptions. Phase 0 changes no production behaviour, database records, customer records, sales, payments, subscriptions or machine commands. It defines what has been observed, what remains unverified, and the rules every later production feature must follow.

## Verified physical workflow

The available shop evidence shows a garment-branding workflow built around:

- A roll-fed vinyl cutter or plotter with a local control panel.
- A manually operated clamshell heat press.
- Coloured heat-transfer vinyl or similar roll material.
- Transparent carrier sheets holding weeded lettering and shapes.
- Garments that receive positioned transfers.
- Human inspection and completion after pressing.

The canonical production journey is:

1. Receive the customer request.
2. Select the garment type, colour and exact size.
3. Select the print location.
4. Confirm artwork dimensions.
5. Select material type and colour.
6. Prepare and approve the artwork.
7. Mirror the artwork when the selected material requires it.
8. Prepare the cutter job.
9. Cut and weed the vinyl.
10. Position the transfer on the garment.
11. Apply the correct temperature, time and pressure on the heat press.
12. Inspect the finished garment, collect any outstanding balance and complete the order.

## Canonical print locations

The system must support at least:

- Left chest.
- Centre chest.
- Full front.
- Upper back.
- Full back.
- Left sleeve.
- Right sleeve.
- Shorts left leg.
- Shorts right leg.
- Custom location with operator-entered dimensions and notes.

A location is not only a label. It must later carry safe-area dimensions, garment-size rules, placement guidance and maximum artwork dimensions.

## Required information at each business stage

### Customer request

Capture:

- Customer identity and contact details.
- Requested garment or customer-supplied garment.
- Quantity.
- Due date and priority.
- Exact text, number, logo or artwork instructions.
- Delivery or collection method.
- Quoted price, deposit requirement and balance.

### Garment selection

Capture:

- Garment type.
- Brand or supplier when known.
- Colour.
- Exact size.
- Fabric composition.
- Shop-supplied or customer-supplied status.
- Heat restrictions.
- Cost and selling price when shop-supplied.

The system must never silently select the first size, colour or garment option.

### Artwork preparation

Capture:

- Design version.
- Front, back, sleeve or shorts view.
- Real dimensions in millimetres.
- Customer approval status.
- Approval date and approving person.
- Whether mirroring is required.
- Whether the design contains text, vector artwork or raster artwork.
- Any tracing or outline work required before cutting.

### Cutting

Capture:

- Selected cutter.
- Connection method.
- Material and loaded roll width.
- Blade profile.
- Force.
- Speed.
- Number of passes.
- Origin.
- Mirror state.
- Test-cut result.
- Operator confirmation before sending.
- Sent, completed, failed or cancelled status.

### Weeding and positioning

Capture:

- Cut completed status.
- Weeding completed status.
- Material waste.
- Transfer orientation.
- Placement template.
- Operator notes.
- Recut reason when required.

### Heat pressing

Capture:

- Heat press used.
- Garment fabric.
- Material recipe.
- Temperature.
- Duration.
- Pressure level.
- Peel method.
- Repress duration.
- Operator confirmation for each step.

### Quality and completion

Capture:

- Correct garment, size, colour and quantity.
- Correct artwork and placement.
- No lifted edges.
- No scorch marks.
- No material damage.
- Carrier removed correctly.
- Rework reason when inspection fails.
- Finished-product evidence.
- Final payment status.
- Collection or delivery confirmation.

## Cutter discovery status

The photographs establish that a roll-fed cutter exists, but they do not safely establish:

- Manufacturer.
- Exact model.
- Firmware version.
- Supported command language.
- Supported file formats.
- Windows driver requirements.
- USB or serial connection identity.
- Maximum cutting width.
- Blade offset.
- Reliable force and speed ranges.
- Whether direct browser serial communication is supported.

No later phase may claim direct cutter control until this information is captured and tested against the physical machine.

Possible integration paths include HPGL or PLT, another plotter protocol, a Windows print or plot driver, or documented manufacturer software integration. The correct path must be selected from evidence, not guessed.

## Heat-press discovery status

The observed heat press appears manually controlled. Until a supported electronic interface is physically verified, Eugene Shop Management must treat it as a guided manual process.

The system may:

- Display a verified recipe.
- Run an on-screen timer.
- Record operator confirmations.
- Record quality checks and rework.

The system must not claim that it electronically changes temperature, time or pressure on the press.

## Material discovery model

The initial material register must be able to record:

- Standard heat-transfer vinyl.
- Glitter vinyl.
- Reflective vinyl.
- Flock.
- Stretch vinyl.
- Adhesive sign vinyl.
- Transfer tape.
- Carrier sheets.
- Packaging and consumables.

Each real material profile must eventually include:

- Name, brand, type and colour.
- Roll width and remaining length.
- Cost per metre.
- Compatible fabrics.
- Mirror requirement.
- Recommended blade, force, speed and passes.
- Press temperature, time and pressure.
- Hot, warm or cold peel requirement.
- Repress requirement.
- Warnings and operator notes.

Values must come from the actual supplier instructions and controlled shop tests. The platform must not invent a universal recipe.

## Garment discovery model

The initial garment register must support:

- T-shirts.
- Jerseys.
- Polo shirts.
- Hoodies.
- Sweatshirts.
- Shorts.
- Workwear.
- Customer-supplied garments.
- Other configured garments.

Each garment profile must eventually include colour, size, fabric, supplier, cost, selling price, safe print areas, maximum dimensions and heat restrictions.

## Roles observed in the real process

A small shop may assign several roles to one person, but the workflow must distinguish responsibility for:

- Customer intake and quotation.
- Artwork preparation.
- Customer approval.
- Cutter operation.
- Weeding and positioning.
- Heat-press operation.
- Quality inspection.
- Payment and order completion.

Later permissions and audit records should preserve who performed each sensitive action.

## Non-negotiable safety and accuracy rules

- Never send a cutter job without explicit operator confirmation.
- Never assume a machine protocol from appearance.
- Never assume the first garment size, colour, material or machine option.
- Never send a design wider than the confirmed loaded material width.
- Require a test cut for a new machine or material profile.
- Prevent duplicate sending of the same production job.
- Keep editable artwork separate from production cut geometry.
- Fail closed when raster artwork or unsupported geometry cannot be converted safely.
- Record the operator, time, machine profile and result for every send attempt.
- Do not claim electronic heat-press control without a verified interface.
- Do not publish unverified temperature, pressure, blade or force values as production recipes.

## Phase 0 product decisions

The business platform remains general. Printing and garment production is an optional specialist module, not the identity of the entire product.

The production module must follow a guided sequence:

1. Order and garment context.
2. Garment-view design and customer approval.
3. Production cut-sheet preparation.
4. Material and machine validation.
5. Operator-confirmed cutter send or safe file export.
6. Weeding and positioning.
7. Guided manual heat pressing.
8. Quality inspection and completion.

This separation prevents the design screen from mixing customer-facing design work, machine geometry and manual production controls into one unsafe interface.

## Evidence still required from the shop

Before direct machine integration is approved, capture:

- Clear photograph of the cutter model label.
- Cutter manufacturer and exact model.
- Current cutter software name and version.
- Current Windows computer version.
- Current cable or connection type.
- Windows Device Manager port name.
- USB vendor and product IDs when available.
- A known-good cut file and its extension.
- Current test-cut procedure.
- Current blade, force and speed settings for each real material.
- Maximum usable cutting width and common roll widths.
- Clear photograph of the heat-press controls and model label.
- Heat-press plate size and pressure adjustment method.
- Existing material instructions or supplier recipe sheets.
- One complete observed order from request to final inspection.

## Phase 0 completion definition

Phase 0 documentation is complete when:

- The real end-to-end workflow is recorded.
- Known physical equipment is separated from unverified technical assumptions.
- Required cutter, press, material and garment evidence has a capture process.
- Safety rules and no-go conditions are explicit.
- Later phases have a stable production workflow and data model to follow.

Direct cutter integration remains intentionally blocked until the outstanding machine identity and protocol evidence is supplied and validated.
