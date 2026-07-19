-- AlterEnum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPPLIER';

-- CreateEnum
CREATE TYPE "SupplierOrderStatus" AS ENUM ('DRAFT', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NetworkLinkStatus" AS ENUM ('REQUESTED', 'ACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "NetworkOrderStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ClosingStatus" AS ENUM ('DRAFT', 'BALANCED', 'VARIANCE', 'APPROVED');

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN "networkCode" TEXT;

-- AlterTable
ALTER TABLE "ShopPaymentConfig" ADD COLUMN "paystackSubaccountCode" TEXT;
ALTER TABLE "ShopPaymentConfig" ADD COLUMN "paystackTransactionCharge" INTEGER;
ALTER TABLE "ShopPaymentConfig" ADD COLUMN "paystackChargeBearer" TEXT DEFAULT 'subaccount';
ALTER TABLE "ShopPaymentConfig" ADD COLUMN "settlementBank" TEXT;
ALTER TABLE "ShopPaymentConfig" ADD COLUMN "settlementAccount" TEXT;
ALTER TABLE "ShopPaymentConfig" ADD COLUMN "settlementAccountName" TEXT;
ALTER TABLE "ShopPaymentConfig" ADD COLUMN "shopMomoNumber" TEXT;
ALTER TABLE "ShopPaymentConfig" ADD COLUMN "shopMomoNetwork" TEXT;

-- CreateTable
CREATE TABLE "DailyClosing" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "closedById" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "openingFloat" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "expectedCash" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "manualCash" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cashDifference" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "expectedCard" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "expectedMomo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "creditSales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalSales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "expenses" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refunds" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ClosingStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyClosing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "portalUserId" TEXT,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "categories" TEXT,
    "paymentTerms" TEXT,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 7,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierOrder" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "createdById" TEXT,
    "status" "SupplierOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "orderNumber" TEXT NOT NULL,
    "expectedAt" TIMESTAMP(3),
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "supplierReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierOrderItem" (
    "id" TEXT NOT NULL,
    "supplierOrderId" TEXT NOT NULL,
    "productVariantId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SupplierOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopNetworkLink" (
    "id" TEXT NOT NULL,
    "requesterShopId" TEXT NOT NULL,
    "partnerShopId" TEXT NOT NULL,
    "status" "NetworkLinkStatus" NOT NULL DEFAULT 'REQUESTED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopNetworkLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopNetworkOrder" (
    "id" TEXT NOT NULL,
    "requesterShopId" TEXT NOT NULL,
    "partnerShopId" TEXT NOT NULL,
    "status" "NetworkOrderStatus" NOT NULL DEFAULT 'REQUESTED',
    "orderNumber" TEXT NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopNetworkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopNetworkOrderItem" (
    "id" TEXT NOT NULL,
    "networkOrderId" TEXT NOT NULL,
    "productVariantId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "ShopNetworkOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_networkCode_key" ON "Shop"("networkCode");

-- CreateIndex
CREATE INDEX "Shop_networkCode_idx" ON "Shop"("networkCode");

-- CreateIndex
CREATE UNIQUE INDEX "DailyClosing_shopId_businessDate_key" ON "DailyClosing"("shopId", "businessDate");

-- CreateIndex
CREATE INDEX "DailyClosing_shopId_status_idx" ON "DailyClosing"("shopId", "status");

-- CreateIndex
CREATE INDEX "DailyClosing_closedById_createdAt_idx" ON "DailyClosing"("closedById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_portalUserId_key" ON "Supplier"("portalUserId");

-- CreateIndex
CREATE INDEX "Supplier_shopId_isActive_idx" ON "Supplier"("shopId", "isActive");

-- CreateIndex
CREATE INDEX "Supplier_portalUserId_idx" ON "Supplier"("portalUserId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierOrder_orderNumber_key" ON "SupplierOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "SupplierOrder_shopId_status_idx" ON "SupplierOrder"("shopId", "status");

-- CreateIndex
CREATE INDEX "SupplierOrder_supplierId_createdAt_idx" ON "SupplierOrder"("supplierId", "createdAt");

-- CreateIndex
CREATE INDEX "SupplierOrderItem_supplierOrderId_idx" ON "SupplierOrderItem"("supplierOrderId");

-- CreateIndex
CREATE INDEX "SupplierOrderItem_productVariantId_idx" ON "SupplierOrderItem"("productVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopNetworkLink_requesterShopId_partnerShopId_key" ON "ShopNetworkLink"("requesterShopId", "partnerShopId");

-- CreateIndex
CREATE INDEX "ShopNetworkLink_partnerShopId_status_idx" ON "ShopNetworkLink"("partnerShopId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ShopNetworkOrder_orderNumber_key" ON "ShopNetworkOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "ShopNetworkOrder_requesterShopId_status_idx" ON "ShopNetworkOrder"("requesterShopId", "status");

-- CreateIndex
CREATE INDEX "ShopNetworkOrder_partnerShopId_status_idx" ON "ShopNetworkOrder"("partnerShopId", "status");

-- CreateIndex
CREATE INDEX "ShopNetworkOrderItem_networkOrderId_idx" ON "ShopNetworkOrderItem"("networkOrderId");

-- CreateIndex
CREATE INDEX "ShopNetworkOrderItem_productVariantId_idx" ON "ShopNetworkOrderItem"("productVariantId");

-- AddForeignKey
ALTER TABLE "DailyClosing" ADD CONSTRAINT "DailyClosing_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyClosing" ADD CONSTRAINT "DailyClosing_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_portalUserId_fkey" FOREIGN KEY ("portalUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOrder" ADD CONSTRAINT "SupplierOrder_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOrder" ADD CONSTRAINT "SupplierOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOrder" ADD CONSTRAINT "SupplierOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOrderItem" ADD CONSTRAINT "SupplierOrderItem_supplierOrderId_fkey" FOREIGN KEY ("supplierOrderId") REFERENCES "SupplierOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOrderItem" ADD CONSTRAINT "SupplierOrderItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopNetworkLink" ADD CONSTRAINT "ShopNetworkLink_requesterShopId_fkey" FOREIGN KEY ("requesterShopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopNetworkLink" ADD CONSTRAINT "ShopNetworkLink_partnerShopId_fkey" FOREIGN KEY ("partnerShopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopNetworkOrder" ADD CONSTRAINT "ShopNetworkOrder_requesterShopId_fkey" FOREIGN KEY ("requesterShopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopNetworkOrder" ADD CONSTRAINT "ShopNetworkOrder_partnerShopId_fkey" FOREIGN KEY ("partnerShopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopNetworkOrderItem" ADD CONSTRAINT "ShopNetworkOrderItem_networkOrderId_fkey" FOREIGN KEY ("networkOrderId") REFERENCES "ShopNetworkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopNetworkOrderItem" ADD CONSTRAINT "ShopNetworkOrderItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
