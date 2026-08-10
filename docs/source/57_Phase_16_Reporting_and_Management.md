# Phase 16 — Reporting and management

Phase 16 turns the operational records created in earlier phases into management reports without creating a second accounting, stock, production or platform-health ledger.

## Business management reports

The business **Management reports** page uses the signed-in shop as a mandatory tenant boundary and reports the selected date range from durable operational records.

### Sales and payments

The report shows:

- non-cancelled order value created in the range,
- recognized payments by cash, card, mobile money and store credit,
- outstanding unpaid order balances,
- formal customer debt balances.

Successful payments count as collected. Store credit remains separately visible because it is recognized value but not new cash inflow.

### Supplier balances

Supplier balances come from the signed Phase 14 `SupplierAccountEntry` ledger. Purchases add to the amount owed; supplier payments and return credits reduce it.

### Expenses and cash flow

Cash-flow reporting combines:

- successful cash/card/mobile-money payment inflows,
- debt collections,
- daily-closing expenses,
- daily-closing refunds.

Store credit is excluded from liquid cash inflow. Expense/refund reporting clearly states how many closing days contributed records so management can see when the range is incomplete.

### Production orders, material use and garment stock

The report includes:

- order and custom-production status counts,
- posted vinyl/material use in metres,
- posted vinyl waste in metres and cost,
- frozen production cut-sheet area,
- current garment pieces and stock value,
- low garment stock rows.

Physical use/waste comes from Phase 14 production inventory movements, not estimates saved before stock posting.

### Profit per job and financial truth

Every Phase 14 `ProductionCostSnapshot` in the selected range is shown with:

- garment cost,
- material cost,
- waste cost,
- labour cost,
- design charge,
- pressing charge,
- additional services cost,
- total cost,
- revenue,
- profit.

The reporting layer independently recomputes:

`garment + material + waste + labour + design + pressing + additional services = true job cost`

and then:

`revenue - true job cost = profit`

The report compares this arithmetic with the stored snapshot to the cent. A mismatch produces a visible financial reconciliation warning instead of silently using the stored aggregate.

This is the Phase 16 financial-truth gate: a real production job can be traced from order/payment evidence through material use, garment cost and service charges to the exact reported profit.

### Staff productivity

Staff reporting is deliberately limited to operational throughput:

- orders processed,
- processed order value,
- assigned jobs completed,
- assigned jobs completed on time,
- heat-press runs,
- heat-press passes.

The UI explicitly states this is not an employee-performance or compensation score.

### On-time completion

On-time reporting uses the existing Phase 9 workflow due date and the durable `STATUS_CHANGED → COMPLETED` workflow event timestamp. Jobs without both a due date and completion evidence are excluded from the denominator instead of being guessed as on-time or late.

### Rework rate

Heat-press rework rate counts distinct runs with a durable `REWORK_REQUIRED` event divided by heat-press runs in the selected range.

## Platform administrator reports

A new **Platform reports** page is visible only to unrestricted platform administrators. Restricted admin workers are redirected to their permitted responsibility rather than receiving global tenant intelligence.

### Active businesses

The report shows total and active business records and the number of active verified businesses.

### Subscription, sponsored and grant status

Current `ShopAccessGrant` records are grouped by access type, including paid, free trial, sponsored, promotional, free-forever and emergency access. Active businesses without a current administrator grant are grouped by normal subscription status.

### Subscription revenue and failed payments

Platform billing reports use durable subscription billing records:

- paid `SubscriptionInvoice` rows for revenue in the selected period,
- failed `SubscriptionPaymentAttempt` rows and attempted value.

The current billing model stores platform subscription amounts without a separate currency column; ESM therefore reports these billing figures in the platform billing currency used by the existing admin billing screens (GHS).

### Module usage

Module usage is reported as the count and percentage of active businesses with each module enabled. The UI calls this a **configuration footprint** and does not claim that an enabled module was actively used during the selected date range.

### Support cases

The platform report shows durable open support cases, high/urgent cases and cases resolved during the selected range, with links back to the existing support investigation workflow.

### Provider health

The existing production-integration health service is surfaced read-only so administrators can see configuration and reachability for payment, messaging, storage and other production providers without generating side effects.

### Device bridge / Web Serial health

ESM's supported direct cutter route is browser-mediated Web Serial rather than a permanently connected server USB bridge. Phase 16 therefore reports only evidence the platform can honestly know:

- active compatible Web Serial/HPGL machine profiles,
- prepared jobs,
- sent jobs,
- failed jobs,
- jobs still in sending state,
- sending jobs stale for more than ten minutes,
- shops with failed sends,
- send success rate in the selected range.

The report never claims a live USB connection heartbeat when the browser/device is not connected.

## Tenant and platform boundaries

Business reports scope every operational query to the signed-in `shopId`. Cross-tenant workflow timing SQL joins both `OrderWorkflow` and `Order` on the same shop.

Platform reports intentionally use global records only after confirming the administrator is unrestricted.

## Recommended management routine

1. Select the reporting period.
2. Review sales, collected payments and outstanding balances separately.
3. Review customer and supplier balances.
4. Check liquid cash flow against closing expenses/refunds.
5. Review physical vinyl use/waste and garment stock.
6. Inspect per-job production profit and resolve any reconciliation warning.
7. Review on-time completion and rework trends.
8. Use staff throughput to understand workload, not as a standalone performance judgment.
9. Platform administrators review access modes, billing failures, support workload and integration/device evidence.
10. Investigate any financial mismatch, stale device send or unreachable provider before relying on aggregate management decisions.
