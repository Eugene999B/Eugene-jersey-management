CREATE TYPE "SubscriptionAccessType" AS ENUM (
  'PAID',
  'FREE_TRIAL',
  'SPONSORED',
  'PROMOTIONAL',
  'FREE_FOREVER',
  'EMERGENCY',
  'SUSPENDED'
);

CREATE TYPE "SubscriptionAccessExpiryAction" AS ENUM (
  'EXTEND_AUTOMATICALLY',
  'RETURN_TO_FREE',
  'MOVE_TO_PAID',
  'SUSPEND_ACTIONS',
  'ADMIN_REVIEW'
);

CREATE TABLE "ShopAccessGrant" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "accessType" "SubscriptionAccessType" NOT NULL,
  "planId" TEXT NOT NULL,
  "planVersion" INTEGER NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "priceOverride" DECIMAL(12,2),
  "invoicesDisabled" BOOLEAN NOT NULL DEFAULT false,
  "reason" TEXT NOT NULL,
  "approvedById" TEXT NOT NULL,
  "expiryAction" "SubscriptionAccessExpiryAction" NOT NULL,
  "expiryPlanId" TEXT,
  "automaticExtensionDays" INTEGER,
  "featureOverrides" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "termsSnapshot" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "expiredAt" TIMESTAMP(3),
  "expiryOutcome" TEXT,
  "revokedAt" TIMESTAMP(3),
  "revokedById" TEXT,
  "revocationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ShopAccessGrant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShopAccessGrant_priceOverride_check" CHECK ("priceOverride" IS NULL OR "priceOverride" >= 0),
  CONSTRAINT "ShopAccessGrant_dates_check" CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt"),
  CONSTRAINT "ShopAccessGrant_extension_check" CHECK ("automaticExtensionDays" IS NULL OR ("automaticExtensionDays" >= 1 AND "automaticExtensionDays" <= 3650))
);

CREATE UNIQUE INDEX "ShopAccessGrant_one_active_per_shop" ON "ShopAccessGrant"("shopId") WHERE "isActive" = true;
CREATE INDEX "ShopAccessGrant_shopId_startsAt_endsAt_idx" ON "ShopAccessGrant"("shopId", "startsAt", "endsAt");
CREATE INDEX "ShopAccessGrant_accessType_isActive_idx" ON "ShopAccessGrant"("accessType", "isActive");
CREATE INDEX "ShopAccessGrant_endsAt_isActive_idx" ON "ShopAccessGrant"("endsAt", "isActive");
