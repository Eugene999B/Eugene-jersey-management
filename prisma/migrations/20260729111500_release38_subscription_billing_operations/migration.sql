CREATE TYPE "SubscriptionInvoiceStatus" AS ENUM ('OPEN', 'OVERDUE', 'PAID', 'VOID');

CREATE TABLE "SubscriptionInvoice" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'GHS',
  "amount" DECIMAL(12,2) NOT NULL,
  "billingCycle" "BillingCycle" NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "status" "SubscriptionInvoiceStatus" NOT NULL DEFAULT 'OPEN',
  "planVersion" INTEGER NOT NULL,
  "planName" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "termsSnapshot" JSONB NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt" TIMESTAMP(3),
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  "reminderCount" INTEGER NOT NULL DEFAULT 0,
  "lastReminderAt" TIMESTAMP(3),
  "nextReminderAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriptionPaymentAttempt" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'paystack',
  "reference" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "authorizationUrl" TEXT,
  "providerTransactionId" TEXT,
  "providerChannel" TEXT,
  "gatewayResponse" TEXT,
  "initializedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionPaymentAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionInvoice_invoiceNumber_key" ON "SubscriptionInvoice"("invoiceNumber");
CREATE UNIQUE INDEX "SubscriptionInvoice_shopId_periodStart_periodEnd_key" ON "SubscriptionInvoice"("shopId", "periodStart", "periodEnd");
CREATE INDEX "SubscriptionInvoice_shopId_status_dueAt_idx" ON "SubscriptionInvoice"("shopId", "status", "dueAt");
CREATE INDEX "SubscriptionInvoice_contractId_issuedAt_idx" ON "SubscriptionInvoice"("contractId", "issuedAt");
CREATE INDEX "SubscriptionInvoice_status_dueAt_nextReminderAt_idx" ON "SubscriptionInvoice"("status", "dueAt", "nextReminderAt");

CREATE UNIQUE INDEX "SubscriptionPaymentAttempt_reference_key" ON "SubscriptionPaymentAttempt"("reference");
CREATE INDEX "SubscriptionPaymentAttempt_shopId_status_createdAt_idx" ON "SubscriptionPaymentAttempt"("shopId", "status", "createdAt");
CREATE INDEX "SubscriptionPaymentAttempt_invoiceId_status_createdAt_idx" ON "SubscriptionPaymentAttempt"("invoiceId", "status", "createdAt");

ALTER TABLE "SubscriptionPaymentAttempt"
  ADD CONSTRAINT "SubscriptionPaymentAttempt_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "SubscriptionInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
