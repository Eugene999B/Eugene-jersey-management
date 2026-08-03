-- Phase 8 stores the exact POS tender facts while preserving all existing payments.
ALTER TABLE "Payment"
  ADD COLUMN "tenderedAmount" DECIMAL(12,2),
  ADD COLUMN "changeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}';

CREATE INDEX "Payment_orderId_method_status_idx" ON "Payment"("orderId", "method", "status");
