-- Phase 1: generalize the platform under the Eugene Shop Management identity.
-- Existing shops retain every record and are classified as mixed businesses by default.
CREATE TYPE "BusinessType" AS ENUM ('RETAIL', 'WHOLESALE', 'SERVICES', 'PRODUCTION_PRINTING', 'RENTAL', 'MIXED');

ALTER TABLE "Shop"
ADD COLUMN "businessType" "BusinessType" NOT NULL DEFAULT 'MIXED';

ALTER TABLE "BusinessApplication"
ADD COLUMN "businessType" "BusinessType";

CREATE INDEX "Shop_businessType_isActive_idx" ON "Shop"("businessType", "isActive");
CREATE INDEX "BusinessApplication_businessType_status_submittedAt_idx" ON "BusinessApplication"("businessType", "status", "submittedAt");

ALTER TABLE "PlatformGovernanceSettings"
ALTER COLUMN "platformName" SET DEFAULT 'Eugene Shop Management';

UPDATE "PlatformGovernanceSettings"
SET "platformName" = 'Eugene Shop Management'
WHERE "platformName" = 'Eugene Jersey Management';
