-- CreateEnum
CREATE TYPE "AccountKind" AS ENUM ('USER', 'BUYER');

-- CreateTable
CREATE TABLE "AccountTwoFactor" (
    "id" TEXT NOT NULL,
    "accountKind" "AccountKind" NOT NULL,
    "accountId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "encryptedSecret" TEXT,
    "recoveryCodeHashes" JSONB NOT NULL DEFAULT '[]',
    "pendingEncryptedSecret" TEXT,
    "pendingRecoveryCodeHashes" JSONB NOT NULL DEFAULT '[]',
    "pendingExpiresAt" TIMESTAMP(3),
    "enabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountTwoFactor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountTwoFactor_accountKind_accountId_key" ON "AccountTwoFactor"("accountKind", "accountId");

-- CreateIndex
CREATE INDEX "AccountTwoFactor_enabled_updatedAt_idx" ON "AccountTwoFactor"("enabled", "updatedAt");
