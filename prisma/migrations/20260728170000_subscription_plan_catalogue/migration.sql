CREATE TYPE "SubscriptionPlanChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "tier" "PlanTier" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "monthlyPrice" DECIMAL(12,2),
    "yearlyPrice" DECIMAL(12,2),
    "trialDays" INTEGER NOT NULL DEFAULT 14,
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 7,
    "includedStaffAccounts" INTEGER,
    "maxProducts" INTEGER,
    "maxOrdersPerMonth" INTEGER,
    "features" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "isConfigured" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriptionPlanVersion" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "approvedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubscriptionPlanVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriptionPlanChangeRequest" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "basePlanVersion" INTEGER NOT NULL,
    "status" "SubscriptionPlanChangeStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "decisionNote" TEXT,
    "previousSnapshot" JSONB NOT NULL,
    "proposedSnapshot" JSONB NOT NULL,
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    CONSTRAINT "SubscriptionPlanChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopSubscriptionContract" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "planVersion" INTEGER NOT NULL,
    "billingCycle" "BillingCycle" NOT NULL,
    "subscriptionStatus" "SubscriptionStatus" NOT NULL,
    "monthlyPrice" DECIMAL(12,2),
    "yearlyPrice" DECIMAL(12,2),
    "trialEndsAt" TIMESTAMP(3),
    "renewalAt" TIMESTAMP(3),
    "graceEndsAt" TIMESTAMP(3),
    "termsSnapshot" JSONB NOT NULL,
    "assignedById" TEXT,
    "assignmentReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopSubscriptionContract_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionPlan_tier_key" ON "SubscriptionPlan"("tier");
CREATE INDEX "SubscriptionPlan_isActive_isConfigured_isPublic_idx" ON "SubscriptionPlan"("isActive", "isConfigured", "isPublic");
CREATE UNIQUE INDEX "SubscriptionPlanVersion_planId_version_key" ON "SubscriptionPlanVersion"("planId", "version");
CREATE INDEX "SubscriptionPlanVersion_planId_createdAt_idx" ON "SubscriptionPlanVersion"("planId", "createdAt");
CREATE INDEX "SubscriptionPlanChangeRequest_status_createdAt_idx" ON "SubscriptionPlanChangeRequest"("status", "createdAt");
CREATE INDEX "SubscriptionPlanChangeRequest_planId_status_idx" ON "SubscriptionPlanChangeRequest"("planId", "status");
CREATE INDEX "SubscriptionPlanChangeRequest_requestedById_createdAt_idx" ON "SubscriptionPlanChangeRequest"("requestedById", "createdAt");
CREATE UNIQUE INDEX "ShopSubscriptionContract_shopId_key" ON "ShopSubscriptionContract"("shopId");
CREATE INDEX "ShopSubscriptionContract_planId_subscriptionStatus_idx" ON "ShopSubscriptionContract"("planId", "subscriptionStatus");
CREATE INDEX "ShopSubscriptionContract_subscriptionStatus_renewalAt_idx" ON "ShopSubscriptionContract"("subscriptionStatus", "renewalAt");

ALTER TABLE "SubscriptionPlanVersion" ADD CONSTRAINT "SubscriptionPlanVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPlanChangeRequest" ADD CONSTRAINT "SubscriptionPlanChangeRequest_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopSubscriptionContract" ADD CONSTRAINT "ShopSubscriptionContract_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopSubscriptionContract" ADD CONSTRAINT "ShopSubscriptionContract_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "SubscriptionPlan" ("id", "tier", "name", "description", "trialDays", "gracePeriodDays") VALUES
('plan-free', 'FREE', 'Free', 'Migration placeholder. Submit and approve commercial terms before offering this plan publicly.', 0, 0),
('plan-basic', 'BASIC', 'Basic', 'Migration placeholder. Existing tenant prices remain unchanged until reassigned.', 14, 7),
('plan-pro', 'PRO', 'Pro', 'Migration placeholder. Existing tenant prices remain unchanged until reassigned.', 14, 7),
('plan-enterprise', 'ENTERPRISE', 'Enterprise', 'Migration placeholder. Existing tenant prices remain unchanged until reassigned.', 14, 14);

INSERT INTO "SubscriptionPlanVersion" ("id", "planId", "version", "snapshot", "reason", "approvedById")
SELECT
    'initial-' || "id",
    "id",
    1,
    jsonb_build_object(
        'tier', "tier"::text,
        'name', "name",
        'description', COALESCE("description", ''),
        'currency', "currency",
        'monthlyPrice', NULL,
        'yearlyPrice', NULL,
        'trialDays', "trialDays",
        'gracePeriodDays', "gracePeriodDays",
        'includedStaffAccounts', NULL,
        'maxProducts', NULL,
        'maxOrdersPerMonth', NULL,
        'features', to_jsonb("features"),
        'isConfigured', "isConfigured",
        'isPublic', "isPublic",
        'isActive', "isActive",
        'version', "version"
    ),
    'Initial migration placeholder. No commercial price was invented.',
    'system-migration'
FROM "SubscriptionPlan";

INSERT INTO "ShopSubscriptionContract" (
    "id", "shopId", "planId", "planVersion", "billingCycle", "subscriptionStatus",
    "monthlyPrice", "yearlyPrice", "trialEndsAt", "renewalAt", "graceEndsAt", "termsSnapshot", "assignmentReason"
)
SELECT
    'shop-contract-' || shop."id",
    shop."id",
    plan."id",
    plan."version",
    shop."billingCycle",
    shop."subscriptionStatus",
    shop."monthlyPrice",
    shop."yearlyPrice",
    CASE WHEN shop."subscriptionStatus" = 'TRIAL' THEN shop."subscriptionRenewalAt" ELSE NULL END,
    shop."subscriptionRenewalAt",
    CASE
        WHEN shop."subscriptionStatus" = 'PAST_DUE' AND shop."subscriptionRenewalAt" IS NOT NULL
        THEN shop."subscriptionRenewalAt" + make_interval(days => plan."gracePeriodDays")
        ELSE NULL
    END,
    jsonb_build_object(
        'tier', plan."tier"::text,
        'name', plan."name",
        'description', COALESCE(plan."description", ''),
        'currency', plan."currency",
        'monthlyPrice', CASE WHEN shop."monthlyPrice" IS NULL THEN NULL ELSE shop."monthlyPrice"::text END,
        'yearlyPrice', CASE WHEN shop."yearlyPrice" IS NULL THEN NULL ELSE shop."yearlyPrice"::text END,
        'trialDays', plan."trialDays",
        'gracePeriodDays', plan."gracePeriodDays",
        'includedStaffAccounts', NULL,
        'maxProducts', NULL,
        'maxOrdersPerMonth', NULL,
        'features', to_jsonb(plan."features"),
        'isConfigured', false,
        'isPublic', false,
        'isActive', true,
        'version', plan."version"
    ),
    'Backfilled from the existing tenant billing record without changing its price or status.'
FROM "Shop" shop
JOIN "SubscriptionPlan" plan ON plan."tier" = shop."planTier";
