CREATE TABLE "BuyerEmailVerification" (
  "id" TEXT NOT NULL,
  "buyerId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "usedAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "providerReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BuyerEmailVerification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BuyerEmailVerification_buyerId_key" ON "BuyerEmailVerification"("buyerId");
CREATE INDEX "BuyerEmailVerification_email_verifiedAt_idx" ON "BuyerEmailVerification"("email", "verifiedAt");
CREATE INDEX "BuyerEmailVerification_expiresAt_usedAt_idx" ON "BuyerEmailVerification"("expiresAt", "usedAt");
