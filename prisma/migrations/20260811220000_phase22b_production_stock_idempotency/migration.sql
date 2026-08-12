ALTER TABLE "SupplierAccountEntry"
ADD COLUMN "idempotencyKey" TEXT;

ALTER TABLE "SupplierStockReturn"
ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "SupplierAccountEntry_shopId_idempotencyKey_key"
ON "SupplierAccountEntry"("shopId", "idempotencyKey");

CREATE UNIQUE INDEX "SupplierStockReturn_shopId_idempotencyKey_key"
ON "SupplierStockReturn"("shopId", "idempotencyKey");
