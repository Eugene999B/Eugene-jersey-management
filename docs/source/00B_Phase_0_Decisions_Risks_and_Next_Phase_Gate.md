# Phase 0 — Decisions, Risks and Next-Phase Gate

## Release scope

This Phase 0 release is documentation and discovery governance only. It does not rename live user interfaces, modify database schema, change navigation, send machine commands, alter payments or deploy new production logic.

## Confirmed product decisions

### General platform direction

Eugene Shop Management is a general business-management platform. Printing and garment branding is an optional production module. Retail, wholesale, service, rental and mixed businesses must not be forced to see sports or printing terminology.

### Production process direction

The production module must model the real sequence:

1. Order intake.
2. Exact garment selection.
3. Artwork preparation.
4. Customer approval.
5. Production cut-sheet preparation.
6. Material and machine checks.
7. Operator-confirmed cutting.
8. Weeding and positioning.
9. Guided manual pressing.
10. Quality inspection.
11. Balance collection.
12. Collection or delivery.

### Design and production separation

The customer-facing garment preview and the machine-facing cut sheet are different views of the same approved job.

The garment view focuses on visual placement and customer approval. The cut-sheet view focuses on millimetres, roll width, material usage, mirroring, spacing, copies, weeding boxes and machine-safe geometry.

### Cutter integration decision

Direct cutter integration must use a local device bridge or another verified local mechanism. A web interface must not pretend to be a universal machine driver.

No machine adapter is approved until the manufacturer, exact model, connection, driver or command language and a controlled test are recorded.

### Heat-press decision

The observed press is treated as manual unless an electronic interface is verified. Eugene Shop Management may guide the operator, time the operation and record evidence, but must not claim to control press settings electronically.

### Recipe decision

Material and pressing settings are shop-controlled profiles based on supplier guidance and controlled testing. There is no universal default recipe for every vinyl and fabric combination.

## Primary risks and controls

### Wrong garment option

Risk: the operator produces the correct design on the wrong size, colour or garment.

Controls:

- Explicit option selection.
- Strong selected state.
- Confirmation before adding to an order.
- Persistent display in cart, job, receipt and production screens.
- No automatic first-option fallback.

### Wrong mirroring state

Risk: artwork is cut in the wrong direction.

Controls:

- Material profile records whether mirroring is required.
- Production checklist displays the mirror state.
- Operator confirms before sending.
- Preview shows the final cutting orientation.

### Unsupported cutter command

Risk: guessed commands damage material, create unsafe motion or fail silently.

Controls:

- Machine identity and protocol evidence required.
- Test cut before approving an adapter.
- Width, origin and duplicate-send checks.
- Fail closed for unsupported geometry or protocol.
- Local job log and operator confirmation.

### Incorrect heat recipe

Risk: garment scorching, lifted edges, poor adhesion or material damage.

Controls:

- Verified material and garment profiles.
- Supplier instruction reference.
- Controlled shop test evidence.
- Temperature, time, pressure, peel and repress displayed together.
- Quality checklist and rework record.

### Unapproved artwork

Risk: production begins before the customer approves wording, dimensions or placement.

Controls:

- Versioned artwork.
- Explicit approval status.
- Approval evidence and timestamp.
- Production blocked when approval is required but missing.

### Material waste not recorded

Risk: pricing and profit reports are inaccurate.

Controls:

- Roll width and remaining length.
- Estimated usage before cutting.
- Actual waste after weeding.
- Recut reason and additional usage.

### Duplicate cutter send

Risk: the same job cuts twice.

Controls:

- Unique production-send record.
- Operator confirmation.
- Idempotency key for bridge communication.
- Visible sent status.
- Deliberate resend action with reason.

### Internet interruption

Risk: the browser loses connectivity during production.

Controls for later device-bridge work:

- The bridge stores a validated local queue.
- The bridge reports final state after reconnection.
- A job is never assumed complete only because it was submitted.
- Duplicate prevention survives reconnects.

## Phase 1 entry conditions

Phase 1, platform rename and generalization, may begin after this Phase 0 documentation is merged because it does not depend on cutter protocol details.

Phase 1 must preserve:

- Existing tenant shops.
- Existing products and stock.
- Existing customers.
- Existing orders and sales.
- Existing payments, debts and subscriptions.
- Existing production projects.
- Existing login and settlement compatibility identifiers unless a separate migration is proven safe.

Phase 1 must not:

- Introduce direct machine commands.
- Publish guessed material recipes.
- Remove sports data.
- Convert existing sports fields into required general-business fields.
- break live sessions, payment reconciliation or production administrator access.

## Direct cutter integration gate

The direct cutter phase remains blocked until all of the following are available:

- Manufacturer and exact model.
- Model-label evidence.
- Current software and version.
- Current connection type.
- Device Manager identity.
- Supported output or command format.
- Maximum usable width.
- Known-good test file.
- Controlled test-cut procedure.
- Verified material profile.
- Successful controlled send and cut.
- Failure, cancel and duplicate-send tests.

## Heat-press workflow gate

The guided heat-press phase may proceed when:

- Plate size and controls are recorded.
- Material instructions are available.
- At least one garment-material recipe has controlled test evidence.
- Operator quality checks are agreed.
- Rework reasons and evidence requirements are defined.

Electronic press control remains a separate blocked capability unless a documented computer interface is verified.

## Phase 0 acceptance checklist

- Real production workflow documented.
- Print locations documented.
- Data required at each stage documented.
- Cutter facts and unknowns separated.
- Heat-press limitations documented.
- Material and garment discovery models documented.
- Field-capture forms provided.
- Real-order observation form provided.
- Safety and no-go rules documented.
- Product decisions recorded.
- Risks and controls recorded.
- Phase 1 entry conditions recorded.
- Machine-integration gates recorded.

## Release conclusion

Phase 0 provides the evidence framework and operating truth for every later phase. It intentionally does not claim that the cutter model, protocol or heat-press recipes are known. Those values must be captured from the real shop and validated before machine-specific implementation is approved.
