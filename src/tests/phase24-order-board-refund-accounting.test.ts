import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { netRecognizedPaymentAmount } from "@/lib/payment-accounting";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("Phase 24 order board refund accounting", () => {
  it("reopens the visible balance after a processed partial refund", () => {
    const payments = [{
      amount: 80,
      method: "CARD",
      status: "SUCCESS",
      metadata: { refundProcessedAmount: 20 },
    }];
    const paidAmount = payments
      .filter((payment) => payment.method !== "STORE_CREDIT")
      .reduce((sum, payment) => sum + netRecognizedPaymentAmount(payment), 0);

    expect(paidAmount).toBe(60);
    expect(Math.max(80 - paidAmount, 0)).toBe(20);
  });

  it("uses the same refund-aware payment helper as the order detail screen", () => {
    const board = source("../app/dashboard/orders/page.tsx");
    const detail = source("../app/dashboard/orders/[orderId]/page.tsx");

    expect(board).toContain('import { netRecognizedPaymentAmount } from "@/lib/payment-accounting"');
    expect(board).toContain('payment.method !== "STORE_CREDIT"');
    expect(board).toContain("sum + netRecognizedPaymentAmount(payment)");
    expect(board).not.toContain('payment.status === "SUCCESS")\n            .reduce((sum, payment) => sum + Number(payment.amount), 0)');
    expect(detail).toContain("netRecognizedPaymentAmount(payment)");
  });
});
