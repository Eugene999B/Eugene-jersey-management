ALTER TABLE "BusinessApplication"
ADD COLUMN "duplicateFingerprint" TEXT NOT NULL,
ADD COLUMN "requestedShopId" TEXT;

CREATE INDEX "BusinessApplication_duplicateFingerprint_status_idx"
ON "BusinessApplication"("duplicateFingerprint", "status");

CREATE INDEX "BusinessApplication_requestedShopId_status_idx"
ON "BusinessApplication"("requestedShopId", "status");
