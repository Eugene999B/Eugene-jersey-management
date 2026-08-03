import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizePosTenders, PosTenderValidationError } from "@/lib/pos-tenders";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("Phase 8 POS tender reconciliation", () => {
  it("records exact cash and change", () => {
    const plan = normalizePosTenders([{ method: "CASH", amount: 85, tenderedAmount: 100 }], 85);
    expect(plan.paidAmount).toBe(85);
    expect(plan.creditAmount).toBe(0);
    expect(plan.cashReceived).toBe(100);
    expect(plan.changeAmount).toBe(15);
  });

  it("balances mixed cash and mobile-money tenders", () => {
    const plan = normalizePosTenders([
      { method: "CASH", amount: 50, tenderedAmount: 60 },
      { method: "MOMO", amount: 75, reference: "MOMO-7788", confirmed: true },
    ], 125);
    expect(plan.methods).toEqual(["CASH", "MOMO"]);
    expect(plan.paidAmount).toBe(125);
    expect(plan.changeAmount).toBe(10);
  });

  it("creates credit for only the allocated credit portion", () => {
    const plan = normalizePosTenders([
      { method: "CARD", amount: 80, reference: "TERM-991", confirmed: true },
      { method: "STORE_CREDIT", amount: 45 },
    ], 125);
    expect(plan.paidAmount).toBe(80);
    expect(plan.creditAmount).toBe(45);
  });

  it("allows a zero-total order without fake payment records", () => {
    const plan = normalizePosTenders([], 0);
    expect(plan.tenders).toEqual([]);
    expect(plan.totalAmount).toBe(0);
    expect(plan.paidAmount).toBe(0);
  });

  it.each([
    {
      inputs: [{ method: "CASH" as const, amount: 50 }],
      total: 75,
      code: "PAYMENT_TOTAL_MISMATCH",
    },
    {
      inputs: [{ method: "CASH" as const, amount: 50, tenderedAmount: 40 }],
      total: 50,
      code: "CASH_RECEIVED_LOW",
    },
    {
      inputs: [{ method: "MOMO" as const, amount: 50, reference: "MM1", confirmed: false }],
      total: 50,
      code: "EXTERNAL_CONFIRMATION_REQUIRED",
    },
    {
      inputs: [
        { method: "CASH" as const, amount: 25 },
        { method: "CASH" as const, amount: 25 },
      ],
      total: 50,
      code: "PAYMENT_DUPLICATE_METHOD",
    },
  ])("rejects invalid tender plan $code", ({ inputs, total, code }) => {
    try {
      normalizePosTenders(inputs, total);
      throw new Error("Expected tender validation to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(PosTenderValidationError);
      expect((error as PosTenderValidationError).code).toBe(code);
    }
  });

  it("keeps server, receipt and POS integrations explicit", () => {
    const checkout = source("../app/api/pos/checkout/route.ts");
    const terminal = source("../components/pos/pos-terminal.tsx");
    const panel = source("../components/pos/pos-payment-panel.tsx");
    const receipt = source("../app/api/receipts/[orderId]/route.ts");

    expect(checkout).toContain("normalizePosTenders");
    expect(checkout).toContain("creditAmount");
    expect(checkout).toContain("tenderedAmount");
    expect(checkout).toContain("payments: tenderPlan.tenders.length");
    expect(terminal).toContain("PosPaymentPanel");
    expect(terminal).toContain("payments: tenderSelection.inputs");
    expect(panel).toContain("Split or mixed");
    expect(panel).toContain("Cash received");
    expect(receipt).toContain("Payment breakdown");
    expect(receipt).toContain("Change");
  });
});
