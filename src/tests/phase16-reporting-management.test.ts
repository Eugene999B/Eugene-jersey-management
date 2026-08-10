import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  cashFlowSummary,
  costSnapshotReconciliation,
  financialTruth,
  onTimeSummary,
  outstandingOrderBalance,
  paymentMethodTotals,
  reworkSummary,
} from "@/lib/reporting-analytics";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("Phase 16 reporting and management", () => {
  it("passes the financial truth test with manual production arithmetic", () => {
    const truth = financialTruth({
      revenue: 80,
      garmentCost: 25,
      materialCost: 6.4,
      wasteCost: 1.28,
      labourCost: 5,
      designCharge: 3,
      pressingCharge: 2,
      additionalServicesCost: 1,
    });
    expect(truth.totalCost).toBeCloseTo(43.68, 8);
    expect(truth.profit).toBeCloseTo(36.32, 8);
    expect(truth.marginPercent).toBeCloseTo(45.4, 8);
    const reconciliation = costSnapshotReconciliation({
      storedTotalCost: 43.68,
      storedProfit: 36.32,
      revenue: 80,
      garmentCost: 25,
      materialCost: 6.4,
      wasteCost: 1.28,
      labourCost: 5,
      designCharge: 3,
      pressingCharge: 2,
      additionalServicesCost: 1,
    });
    expect(reconciliation.reconciled).toBe(true);
    expect(reconciliation.totalCostDelta).toBeCloseTo(0, 8);
    expect(reconciliation.profitDelta).toBeCloseTo(0, 8);
  });

  it("detects a production cost/report mismatch instead of hiding it", () => {
    const reconciliation = costSnapshotReconciliation({
      storedTotalCost: 44,
      storedProfit: 36,
      revenue: 80,
      garmentCost: 25,
      materialCost: 6.4,
      wasteCost: 1.28,
      labourCost: 5,
      designCharge: 3,
      pressingCharge: 2,
      additionalServicesCost: 1,
    });
    expect(reconciliation.reconciled).toBe(false);
    expect(Math.abs(reconciliation.totalCostDelta)).toBeGreaterThan(0.01);
  });

  it("reports payment methods and unpaid order balances from recognized payment evidence", () => {
    const payments = [
      { amount: 20, method: "CASH", status: "SUCCESS" },
      { amount: 10, method: "MOMO", status: "SUCCESS" },
      { amount: 5, method: "CARD", status: "FAILED" },
      { amount: 15, method: "STORE_CREDIT", status: "PENDING" },
    ];
    const totals = paymentMethodTotals(payments);
    expect(totals.CASH).toBe(20);
    expect(totals.MOMO).toBe(10);
    expect(totals.CARD).toBe(0);
    expect(totals.STORE_CREDIT).toBe(15);
    expect(totals.total).toBe(45);
    expect(outstandingOrderBalance({ totalAmount: 80, payments })).toBe(35);
  });

  it("calculates on-time completion, rework and cash flow without denominator tricks", () => {
    const due = new Date("2026-08-01T12:00:00Z");
    const timing = onTimeSummary([
      { dueAt: due, completedAt: new Date("2026-08-01T11:00:00Z") },
      { dueAt: due, completedAt: new Date("2026-08-01T13:00:00Z") },
      { dueAt: null, completedAt: new Date("2026-08-01T10:00:00Z") },
    ]);
    expect(timing).toEqual({ measurable: 2, onTime: 1, late: 1, ratePercent: 50 });
    expect(reworkSummary({ totalRuns: 10, reworkedRuns: 2 })).toEqual({ totalRuns: 10, reworkedRuns: 2, ratePercent: 20 });
    expect(cashFlowSummary({ paymentInflows: 100, debtCollections: 20, expenses: 30, refunds: 5 })).toEqual({ inflows: 120, outflows: 35, net: 85 });
  });

  it("scopes business reporting facts to the signed-in shop", () => {
    const page = source("../app/dashboard/reports/page.tsx");
    expect(page).toContain("shopId: shop.id");
    expect(page).toContain("ProductionInventoryMovementType.PRODUCTION_USE");
    expect(page).toContain("ProductionInventoryMovementType.WASTE");
    expect(page).toContain("productionCostSnapshot.findMany");
    expect(page).toContain("supplierAccountEntry.findMany");
    expect(page).toContain("dailyClosing.findMany");
    expect(page).toContain("heatPressEvent.findMany");
    expect(page).toContain("listCompletedOrderTimings(shop.id, start, end)");
    expect(page).toContain("Financial reconciliation warning");
    expect(page).toContain("Production-cost arithmetic reconciles");
  });

  it("uses shop-scoped workflow SQL and explicit completion events for on-time jobs", () => {
    const data = source("../lib/reporting-data.ts");
    expect(data).toContain('workflow."shopId" = ${shopId}');
    expect(data).toContain("events.\"type\" = 'STATUS_CHANGED'");
    expect(data).toContain("events.\"toStatus\" = 'COMPLETED'");
    expect(data).toContain('MAX(events."createdAt") AS "completedAt"');
  });

  it("reports platform access billing modules support and recorded device health only to unrestricted admins", () => {
    const page = source("../app/admin/reports/page.tsx");
    expect(page).toContain("getAllowedPlatformPermissions(session.id)");
    expect(page).toContain("allowedPermissions && allowedPermissions.length > 0");
    expect(page).toContain("shopAccessGrant.findMany");
    expect(page).toContain("subscriptionInvoice.findMany");
    expect(page).toContain("subscriptionPaymentAttempt.findMany");
    expect(page).toContain("supportCase.findMany");
    expect(page).toContain("enabledModules");
    expect(page).toContain("platformDeviceBridgeReport(from, to)");
    expect(page).toContain("browser-mediated Web Serial cutter control");
    expect(page).toContain("does not invent");
  });

  it("derives direct-device health from durable machine production jobs without claiming a server USB heartbeat", () => {
    const data = source("../lib/reporting-data.ts");
    expect(data).toContain('"ShopMachineProfile"');
    expect(data).toContain('"connectionMode" = \'WEB_SERIAL\'');
    expect(data).toContain('"MachineProductionJob"');
    expect(data).toContain('jobs."status" = \'FAILED\'');
    expect(data).toContain("INTERVAL '10 minutes'");
    expect(data).not.toContain("navigator.serial");
  });
});
