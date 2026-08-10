CREATE TYPE "CustomerProductionRequestStatus" AS ENUM ('SUBMITTED', 'QUOTED', 'PREVIEW_READY', 'CHANGES_REQUESTED', 'APPROVED', 'DEPOSIT_PAID', 'IN_PRODUCTION', 'READY', 'COMPLETED', 'CANCELLED');
CREATE TYPE "CustomerProductionEventType" AS ENUM ('SUBMITTED', 'ARTWORK_ATTACHED', 'QUOTED', 'PREVIEW_READY', 'APPROVED', 'CHANGES_REQUESTED', 'ORDER_CREATED', 'DEPOSIT_PAID', 'PRODUCTION_STARTED', 'READY', 'BALANCE_PAID', 'COMPLETED', 'CANCELLED', 'NOTE');

CREATE TABLE "CustomerProductionRequest" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "buyerId" TEXT NOT NULL,
  "productVariantId" TEXT NOT NULL,
  "publicAccessToken" TEXT NOT NULL,
  "status" "CustomerProductionRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
  "title" TEXT NOT NULL,
  "productSnapshot" JSONB NOT NULL,
  "garmentResourceId" TEXT NOT NULL,
  "garmentSnapshot" JSONB NOT NULL,
  "garmentSize" TEXT NOT NULL,
  "placementResourceId" TEXT NOT NULL,
  "placementSnapshot" JSONB NOT NULL,
  "requestedText" TEXT,
  "requestedNumber" TEXT,
  "requestNotes" TEXT,
  "fulfillmentType" "FulfillmentType" NOT NULL DEFAULT 'PICKUP',
  "deliveryAddress" TEXT,
  "deliveryCity" TEXT,
  "deliveryArea" TEXT,
  "deliveryNotes" TEXT,
  "quotedTotal" DECIMAL(12,2),
  "depositAmount" DECIMAL(12,2),
  "previewSvg" TEXT,
  "previewVersion" INTEGER NOT NULL DEFAULT 0,
  "previewNote" TEXT,
  "quoteExpiresAt" TIMESTAMP(3),
  "orderId" TEXT,
  "quotedAt" TIMESTAMP(3),
  "previewReadyAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "depositPaidAt" TIMESTAMP(3),
  "balancePaidAt" TIMESTAMP(3),
  "productionStartedAt" TIMESTAMP(3),
  "readyAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerProductionRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerProductionAsset" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "buyerId" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "byteLength" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "data" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerProductionAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerProductionEvent" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "type" "CustomerProductionEventType" NOT NULL,
  "note" TEXT,
  "metadata" JSONB,
  "actorBuyerId" TEXT,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerProductionEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerProductionRequest_publicAccessToken_key" ON "CustomerProductionRequest"("publicAccessToken");
CREATE UNIQUE INDEX "CustomerProductionRequest_orderId_key" ON "CustomerProductionRequest"("orderId");
CREATE INDEX "CustomerProductionRequest_shopId_status_updatedAt_idx" ON "CustomerProductionRequest"("shopId", "status", "updatedAt");
CREATE INDEX "CustomerProductionRequest_buyerId_updatedAt_idx" ON "CustomerProductionRequest"("buyerId", "updatedAt");
CREATE INDEX "CustomerProductionRequest_shopId_buyerId_updatedAt_idx" ON "CustomerProductionRequest"("shopId", "buyerId", "updatedAt");
CREATE INDEX "CustomerProductionRequest_orderId_idx" ON "CustomerProductionRequest"("orderId");
CREATE INDEX "CustomerProductionAsset_shopId_requestId_createdAt_idx" ON "CustomerProductionAsset"("shopId", "requestId", "createdAt");
CREATE INDEX "CustomerProductionAsset_buyerId_createdAt_idx" ON "CustomerProductionAsset"("buyerId", "createdAt");
CREATE INDEX "CustomerProductionEvent_shopId_requestId_createdAt_idx" ON "CustomerProductionEvent"("shopId", "requestId", "createdAt");
CREATE INDEX "CustomerProductionEvent_requestId_createdAt_idx" ON "CustomerProductionEvent"("requestId", "createdAt");

ALTER TABLE "CustomerProductionRequest" ADD CONSTRAINT "CustomerProductionRequest_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerProductionRequest" ADD CONSTRAINT "CustomerProductionRequest_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "BuyerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerProductionRequest" ADD CONSTRAINT "CustomerProductionRequest_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerProductionRequest" ADD CONSTRAINT "CustomerProductionRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerProductionAsset" ADD CONSTRAINT "CustomerProductionAsset_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerProductionAsset" ADD CONSTRAINT "CustomerProductionAsset_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CustomerProductionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerProductionAsset" ADD CONSTRAINT "CustomerProductionAsset_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "BuyerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerProductionEvent" ADD CONSTRAINT "CustomerProductionEvent_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerProductionEvent" ADD CONSTRAINT "CustomerProductionEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CustomerProductionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerProductionEvent" ADD CONSTRAINT "CustomerProductionEvent_actorBuyerId_fkey" FOREIGN KEY ("actorBuyerId") REFERENCES "BuyerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerProductionEvent" ADD CONSTRAINT "CustomerProductionEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
