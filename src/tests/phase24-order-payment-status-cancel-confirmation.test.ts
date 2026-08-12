import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { orderPaymentStateLabel } from "@/lib/order-payment-state";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("Phase 24 order payment status truth", () => {
  it("distinguishes paid, partial, credit and pending orders using refund-adjusted money", () => {
    expect(orderPaymentStateLabel({
      totalAmount: 80,
      payments: [{ amount: 80, method: "CARD", status: "SUCCESS", metadata: {} }],
    })).toBe("Paid");

    expect(orderPaymentStateLabel({
      totalAmount: 80,
      payments: [{ amount: 20, method: "CARD", status: "SUCCESS", metadata: {} }],
    })).toBe("Part paid");

    expect(orderPaymentStateLabel({
      totalAmount: 80,
      payments: [{ amount: 80, method: "CARD", status: "SUCCESS", metadata: { refundProcessedAmount: 20 } }],
    })).toBe("Part paid");

    expect(orderPaymentStateLabel({
      totalAmount: 80,
      payments: [{ amount: 80, method: "STORE_CREDIT", status: "PENDING", metadata: {} }],
    })).toBe("Credit");

    expect(orderPaymentStateLabel({ totalAmount: 80, payments: [] })).toBe("Pending");

    expect(orderPaymentStateLabel({
      totalAmount: 80,
      payments: [
        { amount: 20, method: "CASH", status: "SUCCESS", metadata: {} },
        { amount: 60, method: "STORE_CREDIT", status: "PENDING", metadata: {} },
      ],
    })).toBe("Part paid");

    expect(orderPaymentStateLabel({ totalAmount: 0, payments: [] })).toBe("Paid");
  });

  it("uses the canonical payment-state label on both dashboard layouts", () => {
    const dashboard = source("src/app/dashboard/page.tsx");
    expect(dashboard).toContain("orderPaymentStateLabel");
    expect(dashboard).toContain('>Payment</th>');
    expect(dashboard).not.toContain('payment.status === "SUCCESS") ? "Paid" : "Pending"');
    expect(dashboard).not.toContain('payment.status === "SUCCESS") ? "Yes" : "No"');
  });
});

describe("Phase 24 order cancellation confirmation", () => {
  it("requires confirmation for Cancelled while keeping ordinary transitions on Button", () => {
    const board = source("src/components/orders/order-board.tsx");
    expect(board).toContain("ConfirmActionButton");
    expect(board).toContain('status === "CANCELLED"');
    expect(board).toContain("This will move the order to Cancelled and may affect stock or fulfilment.");
    expect(board).toContain("<Button");
    expect(board).toContain("updateOrder(order.id, status)");
  });
});
