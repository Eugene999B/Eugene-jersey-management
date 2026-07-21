-- Preserve every customer debt collection and its tender type so daily closing
-- can reconcile cash, card, and mobile-money movements without inflating sales.
CREATE TABLE "DebtPayment" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "receivedById" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DebtPayment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DailyClosing" ADD COLUMN "debtCollections" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "debtCash" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "debtCard" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "debtMomo" DECIMAL(12,2) NOT NULL DEFAULT 0;

CREATE INDEX "DebtPayment_shopId_receivedAt_idx" ON "DebtPayment"("shopId", "receivedAt");
CREATE INDEX "DebtPayment_debtId_receivedAt_idx" ON "DebtPayment"("debtId", "receivedAt");
CREATE INDEX "DebtPayment_receivedById_receivedAt_idx" ON "DebtPayment"("receivedById", "receivedAt");

ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
