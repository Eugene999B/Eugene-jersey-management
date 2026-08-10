import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  addBillingMonths,
  billingInvoiceStatusAt,
  subscriptionPeriodEnd,
} from "@/lib/subscription-billing-rules";

function source(path: string) {
  return readFileSync(new URL(`../../src/${path}`, import.meta.url), "utf8");
}

function repoSource(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("subscription billing operations", () => {
  it("advances monthly and yearly renewal periods in UTC without skipping short months", () => {
    expect(addBillingMonths(new Date("2026-01-31T10:00:00.000Z"), 1).toISOString()).toBe("2026-02-28T10:00:00.000Z");
    expect(addBillingMonths(new Date("2024-01-31T10:00:00.000Z"), 1).toISOString()).toBe("2024-02-29T10:00:00.000Z");
    expect(subscriptionPeriodEnd(new Date("2026-01-31T10:00:00.000Z"), "MONTHLY").toISOString()).toBe("2026-02-28T10:00:00.000Z");
    expect(subscriptionPeriodEnd(new Date("2024-02-29T10:00:00.000Z"), "YEARLY").toISOString()).toBe("2025-02-28T10:00:00.000Z");
  });

  it("marks unpaid invoices overdue only after the due instant", () => {
    expect(billingInvoiceStatusAt({ status: "OPEN", dueAt: new Date("2026-07-10T12:00:00.000Z") }, new Date("2026-07-10T11:59:59.000Z"))).toBe("OPEN");
    expect(billingInvoiceStatusAt({ status: "OPEN", dueAt: new Date("2026-07-10T12:00:00.000Z") }, new Date("2026-07-10T12:00:01.000Z"))).toBe("OVERDUE");
    expect(billingInvoiceStatusAt({ status: "PAID", dueAt: new Date("2026-07-01T00:00:00.000Z") }, new Date("2026-07-10T00:00:00.000Z"))).toBe("PAID");
  });

  it("keeps billing records immutable, platform-owned, and idempotent", () => {
    const billing = source("lib/subscription-billing.ts");
    const webhook = source("app/api/paystack/webhook/route.ts");
    const dashboardActions = source("app/dashboard/settings/actions.ts");
    const terminalGuard = repoSource("prisma/migrations/20260712130000_subscription_billing_operations/migration.sql");
    expect(billing).toContain("shopId_periodStart_periodEnd");
    expect(billing).toContain("isolationLevel: Prisma.TransactionIsolationLevel.Serializable");
    expect(billing).toContain("subscription.payment_verified");
    expect(billing).toContain("subscription-contract-cancelled");
    expect(billing).toContain("invoice-period-covered");
    expect(billing).toContain("const renewalBase");
    expect(terminalGuard).toContain("OLD.\"status\" IN ('PAID'");
    expect(terminalGuard).toContain("RETURN OLD");
    expect(terminalGuard).toContain("EJM_SUBSCRIPTION_INVOICE_PAID_AT_IMMUTABLE");
    expect(terminalGuard).toContain("EJM_SUBSCRIPTION_INVOICE_VOID_AUDIT_REQUIRED");
    expect(dashboardActions).not.toContain("@/lib/platform-db");
    const communicationCall = webhook.indexOf("settleCommunicationCreditPurchase(transactionData)");
    const subscriptionCall = webhook.indexOf("settleSubscriptionInvoicePayment(transactionData)");
    const shopPaymentCall = webhook.indexOf("settlePaystackTransaction(transactionData)");
    expect(communicationCall).toBeGreaterThanOrEqual(0);
    expect(subscriptionCall).toBeGreaterThan(communicationCall);
    expect(shopPaymentCall).toBeGreaterThan(subscriptionCall);
  });

  it("requires explicit administrator reasons for manual settlement and voiding", () => {
    const actions = source("app/admin/billing/invoices/actions.ts");
    const billing = source("lib/subscription-billing.ts");
    expect(actions).toContain("z.string().trim().min(8).max(500)");
    expect(billing).toContain("admin.subscription_invoice_marked_paid");
    expect(billing).toContain("admin.subscription_invoice_voided");
  });
});
