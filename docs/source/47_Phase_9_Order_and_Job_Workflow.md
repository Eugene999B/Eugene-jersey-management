# Phase 9 — Order and job workflow

## Purpose

Phase 9 turns the existing order board into a general order and job control system without replacing the live `Order` model.

The same workflow supports:

- Retail orders
- Wholesale orders
- Service jobs
- Custom production
- Printing and design work
- Rental preparation
- Pickup and delivery handoff

Existing POS sales, online orders, payments, debts, exact product options, design jobs, fulfilment verification, returns and customer tracking remain connected to the original order.

## Additive data model

Phase 9 adds one optional workflow record beside each order and an immutable event timeline.

### Order workflow

The workflow stores:

- Assigned staff member
- Priority: Low, Normal, High or Urgent
- Due date
- Customer approval status
- Approval timestamp and evidence
- Work or production instructions
- Private internal notes
- Deposit target
- Balance due date

Existing orders are backfilled safely. Urgent priority remains synchronized with the existing `rush` field so earlier sorting, reporting and alerts continue to work.

### Workflow events

Events record:

- Order creation
- Status changes
- Assignment changes
- Priority changes
- Due-date changes
- Approval changes
- Instruction changes
- Finance-target changes
- Internal notes
- Pickup or delivery verification
- Cancellation

Events are append-only. They are not used to replace or rewrite existing audit logs; they provide an order-specific operational timeline.

## Order and job control room

Every order now has a dedicated control room that combines:

- Current stage
- Priority and due date
- Assigned staff
- Customer approval
- Work instructions
- Deposit target, paid amount and remaining balance
- Exact item options
- Payment history
- Credit and debt history
- Design jobs
- Fulfilment status
- Return requests
- Customer details
- Immutable workflow timeline

The order board shows the most important facts before staff open the detail page:

- Priority
- Approval status
- Overdue state
- Assigned staff
- Due date
- Paid amount
- Balance
- Exact selected options

## Customer approval gate

Approval-controlled work cannot move from Pending to In Production while approval is:

- Pending
- Changes requested

Production can begin when approval is Approved or Not required.

Approval evidence should record how the approval was received, who approved it, or which changes remain outstanding.

## Permissions

### Owner and manager

Can:

- Assign staff
- Change priority and due date
- Record approval
- Add work instructions
- Set deposit and balance targets
- Add internal notes
- Move order stages

### Cashier

Can:

- Update operational workflow fields
- Set finance targets
- Add internal notes
- Move allowed order stages
- Verify pickup and payment collection

Cannot assign responsibility.

### Designer

Can:

- Update production priority and deadline
- Record approval evidence
- Update work instructions
- Add internal notes
- Move Pending to In Production
- Move In Production to Ready

Cannot assign staff or change finance targets.

### Accountant

Can:

- Set deposit target
- Set balance due date
- Add internal finance notes

Cannot change assignment, production priority, approval or production instructions.

### Viewer

Can read the unified order page but cannot change the workflow.

## Payment and balance truth

The control room uses the Phase 8 payment records:

- Successful payments count as paid now.
- Pending store credit remains the credit portion.
- Remaining balance equals order total minus successful payments.
- Refunds remain visible separately.
- Existing debt, installment and debt-payment records remain authoritative.

The deposit target is an operational target only. It does not create a payment, debt or refund and cannot exceed the order total.

## Fulfilment

Verified pickup and verified delivery create workflow events and complete the existing order through the established secure verification flows.

No pickup code, customer phone, internal note or staff assignment is exposed in a public timeline event.

## Customer tracking privacy

The customer page may show:

- Current order stage
- Expected date
- Approval state
- Amount paid
- Remaining balance
- Credit portion
- Exact ordered options
- Public progress events
- Pickup or delivery state

It must not show:

- Assigned staff
- Internal notes
- Production instructions
- Approval evidence text
- Audit metadata
- Private event notes

## Tenant isolation

Workflow storage is accessed through a dedicated service because the new tables are intentionally additive and not exposed through the tenant Prisma client.

Every unrestricted query requires both:

- `shopId`
- `orderId`

Assignees are accepted only when they are active staff in the same business. Super administrators and supplier accounts cannot be assigned to tenant orders.

## Migration safety

The migration:

- Creates only new workflow tables and indexes.
- Adds foreign keys to existing orders, shops and users.
- Backfills one workflow record per existing order.
- Backfills one initial event per existing order.
- Does not rewrite orders, payments, debts, stock, fulfilment or return records.
- Does not delete existing data.

## Verification

Permanent verification includes:

- Migration safety checks
- Workflow constants and event-type checks
- Tenant-scope source guards
- Approval-gate checks
- Pickup and delivery event checks
- Role-permission checks
- Customer privacy checks
- A mobile Chromium journey that creates a real paid POS order, assigns responsibility, sets priority and deadlines, proves the approval block, records approval, advances production, verifies the board summary and confirms that private notes do not appear in customer tracking
- Full migration, lint, TypeScript, unit, tenant-isolation, documentation, production-build and Chromium validation before merge
