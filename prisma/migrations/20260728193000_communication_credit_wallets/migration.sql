CREATE TYPE "CommunicationCreditChannel" AS ENUM ('SMS', 'WHATSAPP');
CREATE TYPE "CommunicationCreditPackageChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "CommunicationCreditPurchaseStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED');
CREATE TYPE "CommunicationCreditLedgerType" AS ENUM ('PURCHASE', 'USAGE', 'REFUND', 'ADJUSTMENT');

CREATE TABLE "CommunicationCreditPackage" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "channel" "CommunicationCreditChannel" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "price" DECIMAL(12,2),
    "creditUnits" INTEGER,
    "bonusUnits" INTEGER NOT NULL DEFAULT 0,
    "isConfigured" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunicationCreditPackage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CommunicationCreditPackage_creditUnits_check" CHECK ("creditUnits" IS NULL OR "creditUnits" > 0),
    CONSTRAINT "CommunicationCreditPackage_bonusUnits_check" CHECK ("bonusUnits" >= 0),
    CONSTRAINT "CommunicationCreditPackage_price_check" CHECK ("price" IS NULL OR "price" >= 0),
    CONSTRAINT "CommunicationCreditPackage_version_check" CHECK ("version" > 0)
);

CREATE TABLE "CommunicationCreditPackageVersion" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "approvedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunicationCreditPackageVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationCreditPackageChangeRequest" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "baseVersion" INTEGER NOT NULL,
    "status" "CommunicationCreditPackageChangeStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "decisionNote" TEXT,
    "previousSnapshot" JSONB NOT NULL,
    "proposedSnapshot" JSONB NOT NULL,
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    CONSTRAINT "CommunicationCreditPackageChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopCommunicationWallet" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "channel" "CommunicationCreditChannel" NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "lifetimePurchased" INTEGER NOT NULL DEFAULT 0,
    "lifetimeUsed" INTEGER NOT NULL DEFAULT 0,
    "lifetimeRefunded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopCommunicationWallet_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ShopCommunicationWallet_balance_check" CHECK ("balance" >= 0),
    CONSTRAINT "ShopCommunicationWallet_totals_check" CHECK ("lifetimePurchased" >= 0 AND "lifetimeUsed" >= 0 AND "lifetimeRefunded" >= 0)
);

CREATE TABLE "CommunicationCreditPurchase" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "packageVersion" INTEGER NOT NULL,
    "channel" "CommunicationCreditChannel" NOT NULL,
    "creditUnits" INTEGER NOT NULL,
    "bonusUnits" INTEGER NOT NULL DEFAULT 0,
    "totalUnits" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "CommunicationCreditPurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'PAYSTACK',
    "providerReference" TEXT NOT NULL,
    "packageSnapshot" JSONB NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "gatewayResponse" TEXT,
    "providerChannel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunicationCreditPurchase_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CommunicationCreditPurchase_units_check" CHECK ("creditUnits" > 0 AND "bonusUnits" >= 0 AND "totalUnits" = "creditUnits" + "bonusUnits"),
    CONSTRAINT "CommunicationCreditPurchase_amount_check" CHECK ("amount" >= 0),
    CONSTRAINT "CommunicationCreditPurchase_version_check" CHECK ("packageVersion" > 0)
);

CREATE TABLE "CommunicationCreditLedgerEntry" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "channel" "CommunicationCreditChannel" NOT NULL,
    "type" "CommunicationCreditLedgerType" NOT NULL,
    "delta" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "purchaseId" TEXT,
    "customerMessageId" TEXT,
    "reason" TEXT NOT NULL,
    "createdById" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunicationCreditLedgerEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CommunicationCreditLedgerEntry_delta_check" CHECK ("delta" <> 0),
    CONSTRAINT "CommunicationCreditLedgerEntry_balance_check" CHECK ("balanceAfter" >= 0)
);

CREATE UNIQUE INDEX "CommunicationCreditPackage_code_key" ON "CommunicationCreditPackage"("code");
CREATE INDEX "CommunicationCreditPackage_channel_isActive_isConfigured_isPublic_idx" ON "CommunicationCreditPackage"("channel", "isActive", "isConfigured", "isPublic");
CREATE UNIQUE INDEX "CommunicationCreditPackageVersion_packageId_version_key" ON "CommunicationCreditPackageVersion"("packageId", "version");
CREATE INDEX "CommunicationCreditPackageVersion_packageId_createdAt_idx" ON "CommunicationCreditPackageVersion"("packageId", "createdAt");
CREATE INDEX "CommunicationCreditPackageChangeRequest_status_createdAt_idx" ON "CommunicationCreditPackageChangeRequest"("status", "createdAt");
CREATE INDEX "CommunicationCreditPackageChangeRequest_packageId_status_idx" ON "CommunicationCreditPackageChangeRequest"("packageId", "status");
CREATE INDEX "CommunicationCreditPackageChangeRequest_requestedById_createdAt_idx" ON "CommunicationCreditPackageChangeRequest"("requestedById", "createdAt");
CREATE UNIQUE INDEX "ShopCommunicationWallet_shopId_channel_key" ON "ShopCommunicationWallet"("shopId", "channel");
CREATE INDEX "ShopCommunicationWallet_shopId_updatedAt_idx" ON "ShopCommunicationWallet"("shopId", "updatedAt");
CREATE UNIQUE INDEX "CommunicationCreditPurchase_providerReference_key" ON "CommunicationCreditPurchase"("providerReference");
CREATE INDEX "CommunicationCreditPurchase_shopId_status_createdAt_idx" ON "CommunicationCreditPurchase"("shopId", "status", "createdAt");
CREATE INDEX "CommunicationCreditPurchase_packageId_createdAt_idx" ON "CommunicationCreditPurchase"("packageId", "createdAt");
CREATE UNIQUE INDEX "CommunicationCreditLedgerEntry_reference_key" ON "CommunicationCreditLedgerEntry"("reference");
CREATE INDEX "CommunicationCreditLedgerEntry_shopId_channel_createdAt_idx" ON "CommunicationCreditLedgerEntry"("shopId", "channel", "createdAt");
CREATE INDEX "CommunicationCreditLedgerEntry_purchaseId_idx" ON "CommunicationCreditLedgerEntry"("purchaseId");
CREATE INDEX "CommunicationCreditLedgerEntry_customerMessageId_idx" ON "CommunicationCreditLedgerEntry"("customerMessageId");

ALTER TABLE "CommunicationCreditPackageVersion" ADD CONSTRAINT "CommunicationCreditPackageVersion_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "CommunicationCreditPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationCreditPackageChangeRequest" ADD CONSTRAINT "CommunicationCreditPackageChangeRequest_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "CommunicationCreditPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopCommunicationWallet" ADD CONSTRAINT "ShopCommunicationWallet_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationCreditPurchase" ADD CONSTRAINT "CommunicationCreditPurchase_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationCreditPurchase" ADD CONSTRAINT "CommunicationCreditPurchase_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "CommunicationCreditPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunicationCreditLedgerEntry" ADD CONSTRAINT "CommunicationCreditLedgerEntry_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationCreditLedgerEntry" ADD CONSTRAINT "CommunicationCreditLedgerEntry_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "CommunicationCreditPurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationCreditLedgerEntry" ADD CONSTRAINT "CommunicationCreditLedgerEntry_customerMessageId_fkey" FOREIGN KEY ("customerMessageId") REFERENCES "CustomerMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "CommunicationCreditPackage" ("id", "code", "channel", "name", "description") VALUES
('credit-package-sms-starter', 'SMS-STARTER', 'SMS', 'SMS Starter', 'Migration placeholder. Submit and approve the real price and credit quantity before offering this package.'),
('credit-package-sms-growth', 'SMS-GROWTH', 'SMS', 'SMS Growth', 'Migration placeholder. Submit and approve the real price and credit quantity before offering this package.'),
('credit-package-whatsapp-starter', 'WHATSAPP-STARTER', 'WHATSAPP', 'WhatsApp Starter', 'Migration placeholder. Submit and approve the real price and credit quantity before offering this package.'),
('credit-package-whatsapp-growth', 'WHATSAPP-GROWTH', 'WHATSAPP', 'WhatsApp Growth', 'Migration placeholder. Submit and approve the real price and credit quantity before offering this package.');

INSERT INTO "CommunicationCreditPackageVersion" ("id", "packageId", "version", "snapshot", "reason", "approvedById")
SELECT
    'initial-' || "id",
    "id",
    1,
    jsonb_build_object(
        'code', "code",
        'channel', "channel"::text,
        'name', "name",
        'description', COALESCE("description", ''),
        'currency', "currency",
        'price', NULL,
        'creditUnits', NULL,
        'bonusUnits', "bonusUnits",
        'isConfigured', "isConfigured",
        'isPublic', "isPublic",
        'isActive', "isActive",
        'version', "version"
    ),
    'Initial migration placeholder. No package price or credit quantity was invented.',
    'system-migration'
FROM "CommunicationCreditPackage";

INSERT INTO "ShopCommunicationWallet" ("id", "shopId", "channel")
SELECT 'wallet-' || shop."id" || '-sms', shop."id", 'SMS'::"CommunicationCreditChannel" FROM "Shop" shop
UNION ALL
SELECT 'wallet-' || shop."id" || '-whatsapp', shop."id", 'WHATSAPP'::"CommunicationCreditChannel" FROM "Shop" shop;
