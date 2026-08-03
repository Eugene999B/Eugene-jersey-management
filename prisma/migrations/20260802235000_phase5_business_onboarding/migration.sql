-- Phase 5 adds guided configuration without disturbing operational tenants.
ALTER TABLE "Shop"
  ADD COLUMN "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "receiptHeader" TEXT,
  ADD COLUMN "receiptFooter" TEXT,
  ADD COLUMN "defaultDepositPercent" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "productionSetup" JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN "onboardingCurrentStep" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "onboardingCompletedSteps" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN "onboardingStartedAt" TIMESTAMP(3),
  ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

-- Existing businesses are already operating and must never be blocked by the new wizard.
UPDATE "Shop"
SET
  "onboardingCurrentStep" = 10,
  "onboardingCompletedSteps" = ARRAY[1,2,3,4,5,6,7,8,9,10]::INTEGER[],
  "onboardingCompletedAt" = CURRENT_TIMESTAMP;

ALTER TABLE "Shop"
  ADD CONSTRAINT "Shop_taxRate_check" CHECK ("taxRate" >= 0 AND "taxRate" <= 100),
  ADD CONSTRAINT "Shop_defaultDepositPercent_check" CHECK ("defaultDepositPercent" >= 0 AND "defaultDepositPercent" <= 100),
  ADD CONSTRAINT "Shop_onboardingCurrentStep_check" CHECK ("onboardingCurrentStep" >= 1 AND "onboardingCurrentStep" <= 10);
