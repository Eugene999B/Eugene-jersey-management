-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'BASIC', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'OWNER', 'MANAGER', 'CASHIER', 'DESIGNER', 'INVENTORY_CLERK', 'ACCOUNTANT', 'VIEWER');

-- CreateEnum
CREATE TYPE "AttributeType" AS ENUM ('TEXT', 'NUMBER', 'SELECT');

-- CreateEnum
CREATE TYPE "ProductCondition" AS ENUM ('NEW', 'USED', 'REFURBISHED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'IN_PRODUCTION', 'READY', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('POS', 'ONLINE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'MOMO', 'STORE_CREDIT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'SMS', 'WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'READ');

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#0f766e',
    "secondaryColor" TEXT NOT NULL DEFAULT '#f97316',
    "planTier" "PlanTier" NOT NULL DEFAULT 'BASIC',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "city" TEXT,
    "country" TEXT DEFAULT 'Ghana',
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "shopId" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentCategoryId" TEXT,
    "attributeTemplateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributeTemplate" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttributeTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributeField" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AttributeType" NOT NULL,
    "options" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AttributeField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "brand" TEXT,
    "condition" "ProductCondition" NOT NULL DEFAULT 'NEW',
    "isPersonalizable" BOOLEAN NOT NULL DEFAULT false,
    "isService" BOOLEAN NOT NULL DEFAULT false,
    "isRentable" BOOLEAN NOT NULL DEFAULT false,
    "basePrice" DECIMAL(12,2) NOT NULL,
    "dailyRentalRate" DECIMAL(12,2),
    "serviceDurationMins" INTEGER,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
    "images" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "priceOverride" DECIMAL(12,2),
    "barcode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "group" TEXT NOT NULL DEFAULT 'Retail',
    "notes" TEXT,
    "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "customerId" TEXT,
    "processedById" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "channel" "OrderChannel" NOT NULL DEFAULT 'POS',
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "rush" BOOLEAN NOT NULL DEFAULT false,
    "receiptNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "personalizationData" JSONB,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "providerReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteToken" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "shopId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementDismissal" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleHold" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "cart" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "userId" TEXT,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopPaymentConfig" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "paystackPublicKey" TEXT,
    "paystackSecretKeyRef" TEXT,
    "momoProvider" TEXT DEFAULT 'Paystack',
    "allowCash" BOOLEAN NOT NULL DEFAULT true,
    "allowCard" BOOLEAN NOT NULL DEFAULT true,
    "allowMomo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopPaymentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "shopId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_slug_key" ON "Shop"("slug");

-- CreateIndex
CREATE INDEX "Shop_isActive_planTier_idx" ON "Shop"("isActive", "planTier");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_shopId_id_idx" ON "User"("shopId", "id");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE INDEX "Category_shopId_id_idx" ON "Category"("shopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Category_shopId_name_key" ON "Category"("shopId", "name");

-- CreateIndex
CREATE INDEX "AttributeTemplate_shopId_id_idx" ON "AttributeTemplate"("shopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AttributeTemplate_shopId_name_key" ON "AttributeTemplate"("shopId", "name");

-- CreateIndex
CREATE INDEX "Product_shopId_id_idx" ON "Product"("shopId", "id");

-- CreateIndex
CREATE INDEX "Product_shopId_categoryId_idx" ON "Product"("shopId", "categoryId");

-- CreateIndex
CREATE INDEX "Product_shopId_condition_idx" ON "Product"("shopId", "condition");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_id_idx" ON "ProductVariant"("productId", "id");

-- CreateIndex
CREATE INDEX "ProductVariant_sku_idx" ON "ProductVariant"("sku");

-- CreateIndex
CREATE INDEX "Customer_shopId_id_idx" ON "Customer"("shopId", "id");

-- CreateIndex
CREATE INDEX "Customer_shopId_phone_idx" ON "Customer"("shopId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Order_receiptNumber_key" ON "Order"("receiptNumber");

-- CreateIndex
CREATE INDEX "Order_shopId_id_idx" ON "Order"("shopId", "id");

-- CreateIndex
CREATE INDEX "Order_shopId_status_idx" ON "Order"("shopId", "status");

-- CreateIndex
CREATE INDEX "Order_shopId_createdAt_idx" ON "Order"("shopId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InviteToken_tokenHash_key" ON "InviteToken"("tokenHash");

-- CreateIndex
CREATE INDEX "InviteToken_shopId_id_idx" ON "InviteToken"("shopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementDismissal_announcementId_userId_key" ON "AnnouncementDismissal"("announcementId", "userId");

-- CreateIndex
CREATE INDEX "SaleHold_shopId_id_idx" ON "SaleHold"("shopId", "id");

-- CreateIndex
CREATE INDEX "Notification_shopId_id_idx" ON "Notification"("shopId", "id");

-- CreateIndex
CREATE INDEX "Notification_userId_status_idx" ON "Notification"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ShopPaymentConfig_shopId_key" ON "ShopPaymentConfig"("shopId");

-- CreateIndex
CREATE INDEX "AuditLog_shopId_id_idx" ON "AuditLog"("shopId", "id");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_attributeTemplateId_fkey" FOREIGN KEY ("attributeTemplateId") REFERENCES "AttributeTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributeTemplate" ADD CONSTRAINT "AttributeTemplate_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributeField" ADD CONSTRAINT "AttributeField_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AttributeTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteToken" ADD CONSTRAINT "InviteToken_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteToken" ADD CONSTRAINT "InviteToken_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementDismissal" ADD CONSTRAINT "AnnouncementDismissal_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementDismissal" ADD CONSTRAINT "AnnouncementDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleHold" ADD CONSTRAINT "SaleHold_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopPaymentConfig" ADD CONSTRAINT "ShopPaymentConfig_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
