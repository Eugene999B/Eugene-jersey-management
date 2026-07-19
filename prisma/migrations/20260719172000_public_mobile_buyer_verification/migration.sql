-- CreateEnum
CREATE TYPE "ShopVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "FulfillmentType" AS ENUM ('PICKUP', 'DELIVERY');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('NOT_REQUIRED', 'REQUESTED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "PhoneVerificationPurpose" AS ENUM ('BUYER_LOGIN', 'BUYER_PASSWORD_RESET', 'STAFF_PASSWORD_RESET', 'PICKUP_VERIFY', 'DELIVERY_VERIFY');

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN "staffLoginId" TEXT;
ALTER TABLE "Shop" ADD COLUMN "verificationStatus" "ShopVerificationStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Shop" ADD COLUMN "legalBusinessName" TEXT;
ALTER TABLE "Shop" ADD COLUMN "businessRegistrationNumber" TEXT;
ALTER TABLE "Shop" ADD COLUMN "taxIdentificationNumber" TEXT;
ALTER TABLE "Shop" ADD COLUMN "ownerGovernmentId" TEXT;
ALTER TABLE "Shop" ADD COLUMN "credentialContactName" TEXT;
ALTER TABLE "Shop" ADD COLUMN "credentialPhone" TEXT;
ALTER TABLE "Shop" ADD COLUMN "credentialEmail" TEXT;
ALTER TABLE "Shop" ADD COLUMN "credentialAddress" TEXT;
ALTER TABLE "Shop" ADD COLUMN "credentialDocumentUrl" TEXT;
ALTER TABLE "Shop" ADD COLUMN "verifiedAt" TIMESTAMP(3);
ALTER TABLE "Shop" ADD COLUMN "verifiedById" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "productType" TEXT;
ALTER TABLE "Product" ADD COLUMN "sportType" TEXT;
ALTER TABLE "Product" ADD COLUMN "teamName" TEXT;
ALTER TABLE "Product" ADD COLUMN "sizeGuide" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "buyerId" TEXT;
ALTER TABLE "Order" ADD COLUMN "fulfillmentType" "FulfillmentType" NOT NULL DEFAULT 'PICKUP';
ALTER TABLE "Order" ADD COLUMN "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'NOT_REQUIRED';
ALTER TABLE "Order" ADD COLUMN "deliveryAddress" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryCity" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryArea" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryNotes" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryFee" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "pickupCodeHash" TEXT;
ALTER TABLE "Order" ADD COLUMN "pickupCodeLast4" TEXT;
ALTER TABLE "Order" ADD COLUMN "pickupVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "deliveryVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "customerVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BuyerAccount" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "phoneVerifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneVerificationCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "buyerId" TEXT,
    "phone" TEXT NOT NULL,
    "purpose" "PhoneVerificationPurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneVerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductReview" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_staffLoginId_key" ON "Shop"("staffLoginId");

-- CreateIndex
CREATE INDEX "Shop_staffLoginId_idx" ON "Shop"("staffLoginId");

-- CreateIndex
CREATE INDEX "Shop_verificationStatus_idx" ON "Shop"("verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "BuyerAccount_email_key" ON "BuyerAccount"("email");

-- CreateIndex
CREATE UNIQUE INDEX "BuyerAccount_phone_key" ON "BuyerAccount"("phone");

-- CreateIndex
CREATE INDEX "BuyerAccount_phone_isActive_idx" ON "BuyerAccount"("phone", "isActive");

-- CreateIndex
CREATE INDEX "BuyerAccount_email_idx" ON "BuyerAccount"("email");

-- CreateIndex
CREATE INDEX "Order_buyerId_createdAt_idx" ON "Order"("buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "PhoneVerificationCode_phone_purpose_createdAt_idx" ON "PhoneVerificationCode"("phone", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "PhoneVerificationCode_userId_purpose_idx" ON "PhoneVerificationCode"("userId", "purpose");

-- CreateIndex
CREATE INDEX "PhoneVerificationCode_buyerId_purpose_idx" ON "PhoneVerificationCode"("buyerId", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "ProductReview_productId_buyerId_key" ON "ProductReview"("productId", "buyerId");

-- CreateIndex
CREATE INDEX "ProductReview_shopId_createdAt_idx" ON "ProductReview"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductReview_buyerId_createdAt_idx" ON "ProductReview"("buyerId", "createdAt");

-- AddForeignKey
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "BuyerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneVerificationCode" ADD CONSTRAINT "PhoneVerificationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneVerificationCode" ADD CONSTRAINT "PhoneVerificationCode_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "BuyerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "BuyerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
