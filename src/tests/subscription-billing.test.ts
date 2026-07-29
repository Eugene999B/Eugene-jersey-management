import { readFileSync } from "node:fs";
import { BillingCycle, SubscriptionInvoiceStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { addBillingPeriod, subscriptionInvoiceStatus } from "@/lib/subscription-billing";

function source(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("subscription billing operations", () => {
  it("advances monthly and yearly renewal periods in UTC", () => {
    expect(addBillingPeriod(new Date("2026-07-15T12:00:00.000Z"), BillingCycle.MONTHLY).toISOString()).toBe("2026-08-15T12:00:00.000Z");
    expect(addBillingPeriod(new Date("2026-07-15T12:00:00.000Z"), BillingCycle.YEARLY).toISOString()).toBe("2027-07-15T12:00:00.000Z");
  });

  it("marks unpaid invoices overdue only after the due instant", () => {
    const due = new Date("2026-07-29T12:00:00.000Z");
    expect(subscriptionInvoiceStatus(due, new Date("2026-07-29T11:59:59.000Z"))).toBe(SubscriptionInvoiceStatus.OPEN);
    expect(subscriptionInvoiceStatus(due, due)).toBe(SubscriptionInvoiceStatus.OPEN);
    expect(subscriptionInvoiceStatus(due, new Date("2026-07-29T12:00:01.000Z"))).toBe(SubscriptionInvoiceStatus.OVERDUE);
  });

  it("keeps billing records immutable, platform-owned, and idempotent", () => {
    const model = source("../prisma/models/subscription-billing.prisma");
    const billing = source("lib/subscription-billing.ts");
    const terminalGuard = source("../prisma/migrations/20260729112500_release38_invoice_terminal_state_guard/migration.sql");
    const dashboardActions = source("app/dashboard/subscription/actions.ts");
    const webhook = source("app/api/paystack/webhook/route.ts");

    expect(model).toContain("@@unique([shopId, periodStart, periodEnd])");
    expect(model).toContain("reference             String              @unique");
    expect(billing).toContain("shopId_periodStart_periodEnd");
    expect(billing).toContain("isolationLevel: Prisma.TransactionIsolationLevel.Serializable");
    expect(billing).toContain("subscription.payment_verified");
    expect(terminalGuard).toContain("OLD.\"status\" IN ('PAID'");
    expect(terminalGuard).toContain("RETURN OLD");
    expect(terminalGuard).toContain("EJM_SUBSCRIPTION_INVOICE_PAID_AT_IMMUTABLE");
    expect(terminalGuard).toContain("EJM_SUBSCRIPTION_INVOICE_VOID_AUDIT_REQUIRED");
    expect(dashboardActions).not.toContain("@/lib/platform-db");
    expect(webhook).toContain("settleSubscriptionInvoicePayment");
    expect(webhook.indexOf("settleCommunicationCreditPurchase")).toBeLessThan(webhook.indexOf("settleSubscriptionInvoicePayment"));
    expect(webhook.indexOf("settleSubscriptionInvoicePayment")).toBeLessThan(webhook.indexOf("settlePaystackTransaction(payload.data)"));
  });

  it("requires explicit administrator reasons for manual settlement and voiding", () => {
    const actions = source("app/admin/billing/invoices/actions.ts");
    const billing = source("lib/subscription-billing.ts");
    expect(actions).toContain("z.string().trim().min(8).max(500)");
    expect(billing).toContain("admin.subscription_invoice_marked_paid");
    expect(billing).toContain("admin.subscription_invoice_voided");
  });
});
