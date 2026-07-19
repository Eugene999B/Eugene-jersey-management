-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DebtStatus" AS ENUM ('OPEN', 'PARTIAL', 'PAID', 'OVERDUE', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('SCHEDULED', 'PAID', 'LATE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "DesignJobStatus" AS ENUM ('DRAFT', 'READY', 'SENT_TO_MACHINE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN "publicOrderingEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Shop" ADD COLUMN "storefrontEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Shop" ADD COLUMN "cashOrderHoldMinutes" INTEGER NOT NULL DEFAULT 120;
ALTER TABLE "Shop" ADD COLUMN "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE "Shop" ADD COLUMN "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL';
ALTER TABLE "Shop" ADD COLUMN "monthlyPrice" DECIMAL(12,2);
ALTER TABLE "Shop" ADD COLUMN "yearlyPrice" DECIMAL(12,2);
ALTER TABLE "Shop" ADD COLUMN "subscriptionRenewalAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "cashHoldExpiresAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "publicAccessToken" TEXT;
ALTER TABLE "Order" ADD COLUMN "paystackReference" TEXT;

-- CreateTable
CREATE TABLE "Debt" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT,
    "principalAmount" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "DebtStatus" NOT NULL DEFAULT 'OPEN',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "lastReminderAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebtInstallment" (
    "id" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "status" "InstallmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DebtInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerMessage" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "customerId" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "direction" "MessageDirection" NOT NULL DEFAULT 'OUTBOUND',
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "recipientName" TEXT,
    "recipientPhone" TEXT,
    "recipientEmail" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "providerReference" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerThread" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "customerId" TEXT,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderType" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignJob" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "customerId" TEXT,
    "orderId" TEXT,
    "title" TEXT NOT NULL,
    "canvasJson" JSONB NOT NULL DEFAULT '{}',
    "machineProfile" TEXT,
    "exportFormat" TEXT DEFAULT 'SVG',
    "status" "DesignJobStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Shop_subscriptionStatus_subscriptionRenewalAt_idx" ON "Shop"("subscriptionStatus", "subscriptionRenewalAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_publicAccessToken_key" ON "Order"("publicAccessToken");

-- CreateIndex
CREATE INDEX "Order_publicAccessToken_idx" ON "Order"("publicAccessToken");

-- CreateIndex
CREATE INDEX "Debt_shopId_status_idx" ON "Debt"("shopId", "status");

-- CreateIndex
CREATE INDEX "Debt_customerId_dueDate_idx" ON "Debt"("customerId", "dueDate");

-- CreateIndex
CREATE INDEX "Debt_orderId_idx" ON "Debt"("orderId");

-- CreateIndex
CREATE INDEX "DebtInstallment_debtId_dueDate_idx" ON "DebtInstallment"("debtId", "dueDate");

-- CreateIndex
CREATE INDEX "CustomerMessage_shopId_createdAt_idx" ON "CustomerMessage"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerMessage_customerId_createdAt_idx" ON "CustomerMessage"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerMessage_channel_status_idx" ON "CustomerMessage"("channel", "status");

-- CreateIndex
CREATE INDEX "CustomerThread_shopId_status_idx" ON "CustomerThread"("shopId", "status");

-- CreateIndex
CREATE INDEX "CustomerThread_customerId_updatedAt_idx" ON "CustomerThread"("customerId", "updatedAt");

-- CreateIndex
CREATE INDEX "ChatMessage_threadId_createdAt_idx" ON "ChatMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "DesignJob_shopId_status_idx" ON "DesignJob"("shopId", "status");

-- CreateIndex
CREATE INDEX "DesignJob_customerId_createdAt_idx" ON "DesignJob"("customerId", "createdAt");

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtInstallment" ADD CONSTRAINT "DebtInstallment_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMessage" ADD CONSTRAINT "CustomerMessage_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMessage" ADD CONSTRAINT "CustomerMessage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerThread" ADD CONSTRAINT "CustomerThread_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerThread" ADD CONSTRAINT "CustomerThread_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "CustomerThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignJob" ADD CONSTRAINT "DesignJob_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignJob" ADD CONSTRAINT "DesignJob_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignJob" ADD CONSTRAINT "DesignJob_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
