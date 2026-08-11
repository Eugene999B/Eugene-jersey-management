CREATE TABLE "DebtPaymentSubmission" (
  "key" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "debtId" TEXT NOT NULL,
  "paymentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DebtPaymentSubmission_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "DebtPaymentSubmission_shopId_debtId_idx"
  ON "DebtPaymentSubmission"("shopId", "debtId");

ALTER TABLE "DebtPaymentSubmission"
  ADD CONSTRAINT "DebtPaymentSubmission_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DebtPaymentSubmission"
  ADD CONSTRAINT "DebtPaymentSubmission_debtId_fkey"
  FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DebtPaymentSubmission"
  ADD CONSTRAINT "DebtPaymentSubmission_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "DebtPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
