CREATE TYPE "ProductionInventoryKind" AS ENUM ('GARMENT', 'VINYL', 'TRANSFER_SHEET', 'PACKAGING', 'CONSUMABLE', 'FINISHED_GOOD');
CREATE TYPE "ProductionInventoryUnit" AS ENUM ('PIECE', 'METRE', 'SHEET', 'PACK');
CREATE TYPE "ProductionInventoryMovementType" AS ENUM ('OPENING_BALANCE', 'PURCHASE_RECEIPT', 'PRODUCTION_USE', 'WASTE', 'DAMAGE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'SUPPLIER_RETURN', 'FINISHED_GOOD_IN');
CREATE TYPE "SupplierAccountEntryType" AS ENUM ('PURCHASE', 'PAYMENT', 'RETURN_CREDIT', 'ADJUSTMENT');

CREATE TABLE "ProductionInventoryItem" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "inventoryKey" TEXT NOT NULL,
  "kind" "ProductionInventoryKind" NOT NULL,
  "name" TEXT NOT NULL,
  "colour" TEXT,
  "size" TEXT,
  "unit" "ProductionInventoryUnit" NOT NULL,
  "sourceResourceId" TEXT,
  "productVariantId" TEXT,
  "quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "unitCost" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "lowStockLevel" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductionInventoryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductionInventoryMovement" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "type" "ProductionInventoryMovementType" NOT NULL,
  "quantityDelta" DECIMAL(14,3) NOT NULL,
  "balanceAfter" DECIMAL(14,3) NOT NULL,
  "unitCostSnapshot" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "referenceType" TEXT,
  "referenceId" TEXT,
  "note" TEXT,
  "idempotencyKey" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductionInventoryMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierGoodsReceipt" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "supplierOrderId" TEXT NOT NULL,
  "receiptNumber" TEXT NOT NULL,
  "receivedById" TEXT NOT NULL,
  "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierGoodsReceipt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierCostRecord" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "supplierOrderId" TEXT,
  "supplierOrderItemId" TEXT,
  "productionInventoryItemId" TEXT,
  "productVariantId" TEXT,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "unitCost" DECIMAL(14,4) NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierCostRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierAccountEntry" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "type" "SupplierAccountEntryType" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "supplierOrderId" TEXT,
  "reference" TEXT,
  "note" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierAccountEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierStockReturn" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "productionInventoryItemId" TEXT NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "unitCost" DECIMAL(14,4) NOT NULL,
  "reason" TEXT NOT NULL,
  "reference" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierStockReturn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductionCostSnapshot" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "designProductionBriefId" TEXT NOT NULL,
  "designJobId" TEXT NOT NULL,
  "orderId" TEXT,
  "garmentInventoryItemId" TEXT,
  "materialInventoryItemId" TEXT,
  "garmentCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "materialUsedMetres" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "materialWasteMetres" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "materialCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "wasteCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "labourCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "designCharge" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "pressingCharge" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "additionalServicesCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "revenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "profit" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "marginPercent" DECIMAL(7,2) NOT NULL DEFAULT 0,
  "inventoryPostedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductionCostSnapshot_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SupplierOrderItem" ADD COLUMN "productionInventoryItemId" TEXT;

CREATE UNIQUE INDEX "ProductionInventoryItem_shopId_inventoryKey_key" ON "ProductionInventoryItem"("shopId", "inventoryKey");
CREATE INDEX "ProductionInventoryItem_shopId_kind_isActive_idx" ON "ProductionInventoryItem"("shopId", "kind", "isActive");
CREATE INDEX "ProductionInventoryItem_shopId_sourceResourceId_idx" ON "ProductionInventoryItem"("shopId", "sourceResourceId");
CREATE INDEX "ProductionInventoryItem_shopId_productVariantId_idx" ON "ProductionInventoryItem"("shopId", "productVariantId");
CREATE UNIQUE INDEX "ProductionInventoryMovement_shopId_idempotencyKey_key" ON "ProductionInventoryMovement"("shopId", "idempotencyKey");
CREATE INDEX "ProductionInventoryMovement_shopId_inventoryItemId_createdAt_idx" ON "ProductionInventoryMovement"("shopId", "inventoryItemId", "createdAt");
CREATE INDEX "ProductionInventoryMovement_shopId_type_createdAt_idx" ON "ProductionInventoryMovement"("shopId", "type", "createdAt");
CREATE INDEX "ProductionInventoryMovement_referenceType_referenceId_idx" ON "ProductionInventoryMovement"("referenceType", "referenceId");
CREATE UNIQUE INDEX "SupplierGoodsReceipt_shopId_receiptNumber_key" ON "SupplierGoodsReceipt"("shopId", "receiptNumber");
CREATE INDEX "SupplierGoodsReceipt_shopId_supplierId_createdAt_idx" ON "SupplierGoodsReceipt"("shopId", "supplierId", "createdAt");
CREATE INDEX "SupplierGoodsReceipt_supplierOrderId_createdAt_idx" ON "SupplierGoodsReceipt"("supplierOrderId", "createdAt");
CREATE INDEX "SupplierCostRecord_shopId_supplierId_recordedAt_idx" ON "SupplierCostRecord"("shopId", "supplierId", "recordedAt");
CREATE INDEX "SupplierCostRecord_shopId_productionInventoryItemId_recordedAt_idx" ON "SupplierCostRecord"("shopId", "productionInventoryItemId", "recordedAt");
CREATE INDEX "SupplierCostRecord_shopId_productVariantId_recordedAt_idx" ON "SupplierCostRecord"("shopId", "productVariantId", "recordedAt");
CREATE INDEX "SupplierAccountEntry_shopId_supplierId_createdAt_idx" ON "SupplierAccountEntry"("shopId", "supplierId", "createdAt");
CREATE INDEX "SupplierAccountEntry_shopId_type_createdAt_idx" ON "SupplierAccountEntry"("shopId", "type", "createdAt");
CREATE INDEX "SupplierAccountEntry_supplierOrderId_idx" ON "SupplierAccountEntry"("supplierOrderId");
CREATE INDEX "SupplierStockReturn_shopId_supplierId_createdAt_idx" ON "SupplierStockReturn"("shopId", "supplierId", "createdAt");
CREATE INDEX "SupplierStockReturn_shopId_productionInventoryItemId_createdAt_idx" ON "SupplierStockReturn"("shopId", "productionInventoryItemId", "createdAt");
CREATE UNIQUE INDEX "ProductionCostSnapshot_shopId_designProductionBriefId_key" ON "ProductionCostSnapshot"("shopId", "designProductionBriefId");
CREATE INDEX "ProductionCostSnapshot_shopId_designJobId_idx" ON "ProductionCostSnapshot"("shopId", "designJobId");
CREATE INDEX "ProductionCostSnapshot_shopId_orderId_idx" ON "ProductionCostSnapshot"("shopId", "orderId");
CREATE INDEX "ProductionCostSnapshot_shopId_inventoryPostedAt_idx" ON "ProductionCostSnapshot"("shopId", "inventoryPostedAt");
CREATE INDEX "SupplierOrderItem_productionInventoryItemId_idx" ON "SupplierOrderItem"("productionInventoryItemId");

ALTER TABLE "ProductionInventoryItem" ADD CONSTRAINT "ProductionInventoryItem_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionInventoryItem" ADD CONSTRAINT "ProductionInventoryItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductionInventoryMovement" ADD CONSTRAINT "ProductionInventoryMovement_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionInventoryMovement" ADD CONSTRAINT "ProductionInventoryMovement_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "ProductionInventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionInventoryMovement" ADD CONSTRAINT "ProductionInventoryMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierGoodsReceipt" ADD CONSTRAINT "SupplierGoodsReceipt_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierGoodsReceipt" ADD CONSTRAINT "SupplierGoodsReceipt_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierGoodsReceipt" ADD CONSTRAINT "SupplierGoodsReceipt_supplierOrderId_fkey" FOREIGN KEY ("supplierOrderId") REFERENCES "SupplierOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierGoodsReceipt" ADD CONSTRAINT "SupplierGoodsReceipt_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierCostRecord" ADD CONSTRAINT "SupplierCostRecord_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierCostRecord" ADD CONSTRAINT "SupplierCostRecord_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierCostRecord" ADD CONSTRAINT "SupplierCostRecord_supplierOrderId_fkey" FOREIGN KEY ("supplierOrderId") REFERENCES "SupplierOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierCostRecord" ADD CONSTRAINT "SupplierCostRecord_productionInventoryItemId_fkey" FOREIGN KEY ("productionInventoryItemId") REFERENCES "ProductionInventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierAccountEntry" ADD CONSTRAINT "SupplierAccountEntry_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierAccountEntry" ADD CONSTRAINT "SupplierAccountEntry_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierAccountEntry" ADD CONSTRAINT "SupplierAccountEntry_supplierOrderId_fkey" FOREIGN KEY ("supplierOrderId") REFERENCES "SupplierOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierAccountEntry" ADD CONSTRAINT "SupplierAccountEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierStockReturn" ADD CONSTRAINT "SupplierStockReturn_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierStockReturn" ADD CONSTRAINT "SupplierStockReturn_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierStockReturn" ADD CONSTRAINT "SupplierStockReturn_productionInventoryItemId_fkey" FOREIGN KEY ("productionInventoryItemId") REFERENCES "ProductionInventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierStockReturn" ADD CONSTRAINT "SupplierStockReturn_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionCostSnapshot" ADD CONSTRAINT "ProductionCostSnapshot_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionCostSnapshot" ADD CONSTRAINT "ProductionCostSnapshot_designProductionBriefId_fkey" FOREIGN KEY ("designProductionBriefId") REFERENCES "DesignProductionBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionCostSnapshot" ADD CONSTRAINT "ProductionCostSnapshot_designJobId_fkey" FOREIGN KEY ("designJobId") REFERENCES "DesignJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionCostSnapshot" ADD CONSTRAINT "ProductionCostSnapshot_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductionCostSnapshot" ADD CONSTRAINT "ProductionCostSnapshot_garmentInventoryItemId_fkey" FOREIGN KEY ("garmentInventoryItemId") REFERENCES "ProductionInventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductionCostSnapshot" ADD CONSTRAINT "ProductionCostSnapshot_materialInventoryItemId_fkey" FOREIGN KEY ("materialInventoryItemId") REFERENCES "ProductionInventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductionCostSnapshot" ADD CONSTRAINT "ProductionCostSnapshot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionCostSnapshot" ADD CONSTRAINT "ProductionCostSnapshot_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierOrderItem" ADD CONSTRAINT "SupplierOrderItem_productionInventoryItemId_fkey" FOREIGN KEY ("productionInventoryItemId") REFERENCES "ProductionInventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
