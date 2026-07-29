-- CreateTable
CREATE TABLE "ShopMarketplaceProfile" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "tagline" TEXT,
    "heroImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopMarketplaceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopMarketplaceProfile_shopId_key" ON "ShopMarketplaceProfile"("shopId");

-- CreateIndex
CREATE INDEX "ShopMarketplaceProfile_shopId_idx" ON "ShopMarketplaceProfile"("shopId");

-- AddForeignKey
ALTER TABLE "ShopMarketplaceProfile" ADD CONSTRAINT "ShopMarketplaceProfile_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
