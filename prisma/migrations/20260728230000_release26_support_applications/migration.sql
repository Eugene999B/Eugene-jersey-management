CREATE TYPE "SupportCaseCategory" AS ENUM ('ACCOUNT_ACCESS', 'SHOP_OPERATIONS', 'ORDER', 'PAYMENT', 'MESSAGING', 'INTEGRATION', 'SECURITY', 'APPLICATION', 'OTHER');
CREATE TYPE "SupportCasePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "SupportCaseStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'WAITING_ON_SHOP', 'WAITING_ON_PROVIDER', 'RESOLVED', 'CLOSED');
CREATE TYPE "BusinessApplicationType" AS ENUM ('SHOP', 'SUPPLIER');
CREATE TYPE "BusinessApplicationStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'WITHDRAWN');

CREATE TABLE "SupportCase" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "shopId" TEXT,
    "subjectUserId" TEXT,
    "supplierId" TEXT,
    "assignedToId" TEXT,
    "openedById" TEXT NOT NULL,
    "category" "SupportCaseCategory" NOT NULL,
    "priority" "SupportCasePriority" NOT NULL DEFAULT 'NORMAL',
    "status" "SupportCaseStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "resolution" TEXT,
    "linkedEntityType" TEXT,
    "linkedEntityId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportCaseNote" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportCaseNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessApplication" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "statusTokenHash" TEXT NOT NULL,
    "type" "BusinessApplicationType" NOT NULL,
    "status" "BusinessApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "businessName" TEXT NOT NULL,
    "legalBusinessName" TEXT,
    "businessRegistrationNumber" TEXT,
    "taxIdentificationNumber" TEXT,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Ghana',
    "categories" TEXT,
    "requestedServices" TEXT,
    "applicantNotes" TEXT,
    "documentUrls" JSONB NOT NULL DEFAULT '[]',
    "consentGiven" BOOLEAN NOT NULL,
    "consentedAt" TIMESTAMP(3) NOT NULL,
    "assignedReviewerId" TEXT,
    "reviewNotes" TEXT,
    "decisionReason" TEXT,
    "approvedShopId" TEXT,
    "approvedOwnerUserId" TEXT,
    "approvedSupplierId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessApplication_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BusinessApplication_consent_check" CHECK ("consentGiven" = true)
);

CREATE UNIQUE INDEX "SupportCase_reference_key" ON "SupportCase"("reference");
CREATE INDEX "SupportCase_status_priority_createdAt_idx" ON "SupportCase"("status", "priority", "createdAt");
CREATE INDEX "SupportCase_shopId_status_updatedAt_idx" ON "SupportCase"("shopId", "status", "updatedAt");
CREATE INDEX "SupportCase_assignedToId_status_updatedAt_idx" ON "SupportCase"("assignedToId", "status", "updatedAt");
CREATE INDEX "SupportCase_subjectUserId_createdAt_idx" ON "SupportCase"("subjectUserId", "createdAt");
CREATE INDEX "SupportCase_supplierId_createdAt_idx" ON "SupportCase"("supplierId", "createdAt");
CREATE INDEX "SupportCase_linkedEntityType_linkedEntityId_idx" ON "SupportCase"("linkedEntityType", "linkedEntityId");

CREATE INDEX "SupportCaseNote_caseId_createdAt_idx" ON "SupportCaseNote"("caseId", "createdAt");
CREATE INDEX "SupportCaseNote_authorId_createdAt_idx" ON "SupportCaseNote"("authorId", "createdAt");

CREATE UNIQUE INDEX "BusinessApplication_reference_key" ON "BusinessApplication"("reference");
CREATE UNIQUE INDEX "BusinessApplication_statusTokenHash_key" ON "BusinessApplication"("statusTokenHash");
CREATE INDEX "BusinessApplication_type_status_submittedAt_idx" ON "BusinessApplication"("type", "status", "submittedAt");
CREATE INDEX "BusinessApplication_assignedReviewerId_status_updatedAt_idx" ON "BusinessApplication"("assignedReviewerId", "status", "updatedAt");
CREATE INDEX "BusinessApplication_email_status_idx" ON "BusinessApplication"("email", "status");
CREATE INDEX "BusinessApplication_phone_status_idx" ON "BusinessApplication"("phone", "status");
CREATE INDEX "BusinessApplication_businessRegistrationNumber_status_idx" ON "BusinessApplication"("businessRegistrationNumber", "status");
CREATE INDEX "BusinessApplication_approvedShopId_idx" ON "BusinessApplication"("approvedShopId");
CREATE INDEX "BusinessApplication_approvedSupplierId_idx" ON "BusinessApplication"("approvedSupplierId");

ALTER TABLE "SupportCaseNote" ADD CONSTRAINT "SupportCaseNote_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "SupportCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
