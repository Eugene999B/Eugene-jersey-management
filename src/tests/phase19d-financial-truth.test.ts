import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("Phase 19D period accounting", () => {
  it("attributes cash movement by verification, refund processing and collection dates", () => {
    const financial = source("src/lib/financial-period.ts");
    expect(financial).toContain("verifiedAt: range");
    expect(financial).toContain("processedAt: range");
    expect(financial).toContain("receivedAt: range");
    expect(financial).toContain("captureTotals.CARD - refundTotals.CARD");
    expect(financial).toContain("captureTotals.MOMO - refundTotals.MOMO");
  });

  it("keeps sales booking by order date separate from tender timing", () => {
    const financial = source("src/lib/financial-period.ts");
    expect(financial).toContain('status: { not: "CANCELLED" }, createdAt: range');
    expect(financial).toContain("bookedSales");
    expect(financial).toContain("creditSales");
  });

  it("uses the shared period truth in both closing and management reports", () => {
    const closing = source("src/app/dashboard/closing/actions.ts");
    const reports = source("src/app/dashboard/reports/page.tsx");
    expect(closing).toContain("financialPeriodTotals(session.shopId, start, end)");
    expect(reports).toContain("financialPeriodTotals(shop.id, start, endExclusive)");
    expect(reports).toContain("const sales = periodFinance.bookedSales");
    expect(reports).not.toContain("paymentMethodTotals(periodPayments)");
  });
});

describe("Phase 19D debt collection integrity", () => {
  it("claims each rendered debt collection durably before changing the balance", () => {
    const action = source("src/app/dashboard/debts/actions.ts");
    const helper = source("src/lib/debt-payment-idempotency.ts");
    const migration = source("prisma/migrations/20260811180500_phase19d_debt_collection_idempotency/migration.sql");
    expect(action).toContain("claimDebtPaymentSubmission");
    expect(action).toContain("completeDebtPaymentSubmission");
    expect(helper).toContain('ON CONFLICT ("key") DO NOTHING');
    expect(migration).toContain('PRIMARY KEY ("key")');
  });

  it("requires and rejects reuse of card or mobile-money debt collection references", () => {
    const action = source("src/app/dashboard/debts/actions.ts");
    expect(action).toContain("Card and mobile-money collections require a reference.");
    expect(action).toContain("COLLECTION_REFERENCE_REUSED");
    expect(action).toContain('reference: { equals: parsed.data.reference, mode: "insensitive" }');
  });
});
