CREATE TYPE "PaymentRefundStatus" AS ENUM (
  'REQUESTED',
  'PENDING',
  'PROCESSING',
  'NEEDS_ATTENTION',
  'RECONCILIATION_REQUIRED',
  'FAILED',
  'PROCESSED'
);

CREATE TABLE "PaymentRefund" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "transactionReference" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'paystack',
  "providerRefundId" TEXT,
  "providerRefundReference" TEXT,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'GHS',
  "status" "PaymentRefundStatus" NOT NULL DEFAULT 'REQUESTED',
  "providerStatus" TEXT,
  "reason" TEXT,
  "customerNote" TEXT,
  "merchantNote" TEXT,
  "requestedById" TEXT,
  "providerResponse" JSONB NOT NULL DEFAULT '{}',
  "failureMessage" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "processedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),

  CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentRefund_provider_providerRefundId_key"
ON "PaymentRefund"("provider", "providerRefundId");

CREATE INDEX "PaymentRefund_shopId_paymentId_status_idx"
ON "PaymentRefund"("shopId", "paymentId", "status");

CREATE INDEX "PaymentRefund_shopId_requestedAt_idx"
ON "PaymentRefund"("shopId", "requestedAt");

CREATE INDEX "PaymentRefund_transactionReference_status_idx"
ON "PaymentRefund"("transactionReference", "status");

CREATE INDEX "PaymentRefund_status_updatedAt_idx"
ON "PaymentRefund"("status", "updatedAt");
