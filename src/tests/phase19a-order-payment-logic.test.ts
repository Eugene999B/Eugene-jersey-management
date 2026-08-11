import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isPaystackRefundEligiblePayment } from "@/lib/payment-refund-eligibility";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("Phase 19A refund target integrity", () => {
  it("never classifies manually confirmed POS card or mobile-money tenders as Paystack refunds", () => {
    expect(isPaystackRefundEligiblePayment({
      method: "CARD",
      providerReference: "POS-CARD-terminal-123",
      providerChannel: "POS_CARD",
    })).toBe(false);
    expect(isPaystackRefundEligiblePayment({
      method: "MOMO",
      providerReference: "POS-MOMO-momo-123",
      providerChannel: "POS_MOMO",
    })).toBe(false);
    expect(isPaystackRefundEligiblePayment({
      method: "CARD",
      providerReference: "SHOP-accra-123456",
      providerChannel: "card",
    })).toBe(true);
    expect(isPaystackRefundEligiblePayment({
      method: "CASH",
      providerReference: "SHOP-accra-123456",
      providerChannel: "cash",
    })).toBe(false);
  });

  it("derives refund navigation from tenant-scoped payment/refund records instead of hidden order input", () => {
    const actions = source("src/app/dashboard/orders/refund-actions.ts");
    expect(actions).not.toContain('formData.get("orderId")');
    expect(actions).toContain("canonicalPaymentTarget");
    expect(actions).toContain("canonicalRefundOrderId");
    expect(actions).toContain("order: { shopId }");
    expect(actions).toContain("where: { id: refundId, shopId }");
    expect(actions).toContain("isPaystackRefundEligiblePayment(payment)");
  });
});

describe("Phase 19A POS concurrency safety", () => {
  it("rechecks external references inside a serializable checkout transaction", () => {
    const checkout = source("src/app/api/pos/checkout/route.ts");
    expect(checkout).toContain("Prisma.TransactionIsolationLevel.Serializable");
    expect(checkout).toContain("EXTERNAL_REFERENCE_REUSED");
    expect(checkout).toContain("await tx.payment.findFirst");
    expect(checkout).toContain('providerReference: { in: externalReferences }');
  });

  it("turns idempotency and serialization races into deterministic retry responses instead of 500s", () => {
    const checkout = source("src/app/api/pos/checkout/route.ts");
    expect(checkout).toContain('error.code === "P2002"');
    expect(checkout).toContain("duplicateCheckoutResponse(existing, session.shopId)");
    expect(checkout).toContain('error.code === "P2034"');
    expect(checkout).toContain("Checkout changed while it was being saved");
  });
});
