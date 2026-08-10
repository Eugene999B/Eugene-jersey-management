import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  netRecognizedPaymentAmount,
  processedRefundAmountFromMetadata,
  refundAdjustedPaymentTotals,
} from "@/lib/payment-accounting";
import { outstandingOrderBalance, paymentMethodTotals } from "@/lib/reporting-analytics";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("Paystack refund accounting", () => {
  it("keeps gross capture but recognizes only the net amount after a partial refund", () => {
    const payment = {
      amount: 80,
      method: "CARD",
      status: "SUCCESS",
      metadata: { refundProcessedAmount: 20 },
    };
    expect(processedRefundAmountFromMetadata(payment.metadata)).toBe(20);
    expect(netRecognizedPaymentAmount(payment)).toBe(60);
    expect(refundAdjustedPaymentTotals([payment])).toEqual({
      CASH: 0,
      CARD: 60,
      MOMO: 0,
      STORE_CREDIT: 0,
      total: 60,
      refunded: 20,
    });
  });

  it("treats a fully refunded captured payment as zero net revenue", () => {
    const payment = {
      amount: 80,
      method: "CARD",
      status: "REFUNDED",
      metadata: { refundProcessedAmount: 80 },
    };
    expect(netRecognizedPaymentAmount(payment)).toBe(0);
    expect(paymentMethodTotals([payment])).toMatchObject({ CARD: 0, total: 0, refunded: 80 });
  });

  it("reopens the customer balance after a processed partial refund", () => {
    const order = {
      totalAmount: 80,
      payments: [{
        amount: 80,
        method: "CARD",
        status: "SUCCESS",
        metadata: { refundProcessedAmount: 20 },
      }],
    };
    expect(outstandingOrderBalance(order)).toBe(20);
  });

  it("does not let a pending or ambiguous refund reduce recognized cash yet", () => {
    const payment = {
      amount: 80,
      method: "MOMO",
      status: "SUCCESS",
      metadata: {},
    };
    expect(netRecognizedPaymentAmount(payment)).toBe(80);
  });
});

describe("Paystack refund safety architecture", () => {
  it("uses an explicitly scoped platform repository and serializable refund reservation", () => {
    const refunds = source("src/lib/payment-refunds.ts");
    expect(refunds).toContain('platformDb as prisma');
    expect(refunds).toContain('shopId: input.shopId');
    expect(refunds).toContain('Prisma.TransactionIsolationLevel.Serializable');
    expect(refunds).toContain('REFUND_ALREADY_IN_PROGRESS');
    expect(refunds).toContain('PaymentRefundStatus.RECONCILIATION_REQUIRED');
    expect(refunds).toContain('/refund/retry_with_customer_details/');
  });

  it("does not persist customer bank details in the refund ledger", () => {
    const model = source("prisma/models/payment-refunds.prisma");
    expect(model).not.toContain("accountNumber");
    expect(model).not.toContain("bankId");
    expect(model).not.toContain("bankAccount");
  });

  it("restricts refund mutations to owner, manager and accountant", () => {
    const access = source("src/lib/payment-refund-access.ts");
    expect(access).toContain("Role.OWNER");
    expect(access).toContain("Role.MANAGER");
    expect(access).toContain("Role.ACCOUNTANT");
    expect(access).not.toContain("Role.CASHIER");
  });

  it("processes refund webhooks separately and synchronizes net accounting", () => {
    const webhook = source("src/app/api/paystack/webhook/route.ts");
    expect(webhook).toContain('eventType.startsWith("refund.")');
    expect(webhook).toContain("applyPaystackRefundWebhook");
    expect(webhook).toContain("syncPaymentRefundAccounting");
    expect(webhook).toContain("settleCommunicationCreditPurchase");
    expect(webhook).toContain("settleSubscriptionInvoicePayment");
    expect(webhook).toContain("settlePaystackTransaction");
  });

  it("keeps return workflow from manually declaring a financial refund", () => {
    const commerce = source("src/app/dashboard/commerce/actions.ts");
    const supportedBlock = commerce.slice(
      commerce.indexOf("const supportedReturnStatuses"),
      commerce.indexOf("const allowedReturnTransitions"),
    );
    expect(supportedBlock).not.toContain("ReturnRequestStatus.REFUNDED");
  });

  it("surfaces the same refund truth on order, receipt, closing and platform health", () => {
    expect(source("src/app/dashboard/orders/[orderId]/page.tsx")).toContain("PaymentRefundPanel");
    expect(source("src/app/api/receipts/[orderId]/route.ts")).toContain("Paid net");
    expect(source("src/app/dashboard/closing/page.tsx")).toContain("Cash/manual refunds only");
    expect(source("src/app/admin/integrations/page.tsx")).toContain("PaymentRefundReconciliation");
  });
});
