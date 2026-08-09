CREATE TABLE "ProductionPurchaseLink" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "supplierOrderItemId" TEXT NOT NULL,
  "productionInventoryItemId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductionPurchaseLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductionPurchaseLink_shopId_supplierOrderItemId_key" ON "ProductionPurchaseLink"("shopId", "supplierOrderItemId");
CREATE INDEX "ProductionPurchaseLink_shopId_productionInventoryItemId_idx" ON "ProductionPurchaseLink"("shopId", "productionInventoryItemId");

ALTER TABLE "ProductionPurchaseLink" ADD CONSTRAINT "ProductionPurchaseLink_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionPurchaseLink" ADD CONSTRAINT "ProductionPurchaseLink_supplierOrderItemId_fkey" FOREIGN KEY ("supplierOrderItemId") REFERENCES "SupplierOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionPurchaseLink" ADD CONSTRAINT "ProductionPurchaseLink_productionInventoryItemId_fkey" FOREIGN KEY ("productionInventoryItemId") REFERENCES "ProductionInventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
