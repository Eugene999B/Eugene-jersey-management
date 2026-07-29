-- CreateTable
CREATE TABLE "ShopLocation" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Ghana',
    "region" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "town" TEXT NOT NULL,
    "area" TEXT,
    "digitalAddress" TEXT,
    "streetAddress" TEXT,
    "landmark" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "searchText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopLocation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ShopLocation_latitude_check" CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90),
    CONSTRAINT "ShopLocation_longitude_check" CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180)
);

-- CreateTable
CREATE TABLE "BusinessApplicationLocation" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Ghana',
    "region" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "town" TEXT NOT NULL,
    "area" TEXT,
    "digitalAddress" TEXT,
    "streetAddress" TEXT,
    "landmark" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "searchText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessApplicationLocation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BusinessApplicationLocation_latitude_check" CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90),
    CONSTRAINT "BusinessApplicationLocation_longitude_check" CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180)
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopLocation_shopId_key" ON "ShopLocation"("shopId");
CREATE INDEX "ShopLocation_region_district_town_idx" ON "ShopLocation"("region", "district", "town");
CREATE INDEX "ShopLocation_town_area_idx" ON "ShopLocation"("town", "area");
CREATE INDEX "ShopLocation_searchText_idx" ON "ShopLocation"("searchText");

CREATE UNIQUE INDEX "BusinessApplicationLocation_applicationId_key" ON "BusinessApplicationLocation"("applicationId");
CREATE INDEX "BusinessApplicationLocation_region_district_town_idx" ON "BusinessApplicationLocation"("region", "district", "town");

-- AddForeignKey
ALTER TABLE "ShopLocation" ADD CONSTRAINT "ShopLocation_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessApplicationLocation" ADD CONSTRAINT "BusinessApplicationLocation_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "BusinessApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Copy an approved application's structured address into the new shop without
-- coupling the existing application approval workflow to this release.
CREATE OR REPLACE FUNCTION sync_approved_business_application_location()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."approvedShopId" IS NOT NULL
     AND NEW."approvedShopId" IS DISTINCT FROM OLD."approvedShopId" THEN
    INSERT INTO "ShopLocation" (
      "id", "shopId", "country", "region", "district", "town", "area",
      "digitalAddress", "streetAddress", "landmark", "latitude", "longitude",
      "searchText", "createdAt", "updatedAt"
    )
    SELECT
      'loc_' || md5(random()::text || clock_timestamp()::text || location."applicationId"),
      NEW."approvedShopId",
      location."country",
      location."region",
      location."district",
      location."town",
      location."area",
      location."digitalAddress",
      location."streetAddress",
      location."landmark",
      location."latitude",
      location."longitude",
      location."searchText",
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    FROM "BusinessApplicationLocation" location
    WHERE location."applicationId" = NEW."id"
    ON CONFLICT ("shopId") DO UPDATE SET
      "country" = EXCLUDED."country",
      "region" = EXCLUDED."region",
      "district" = EXCLUDED."district",
      "town" = EXCLUDED."town",
      "area" = EXCLUDED."area",
      "digitalAddress" = EXCLUDED."digitalAddress",
      "streetAddress" = EXCLUDED."streetAddress",
      "landmark" = EXCLUDED."landmark",
      "latitude" = EXCLUDED."latitude",
      "longitude" = EXCLUDED."longitude",
      "searchText" = EXCLUDED."searchText",
      "updatedAt" = CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "BusinessApplication_sync_shop_location"
AFTER UPDATE OF "approvedShopId" ON "BusinessApplication"
FOR EACH ROW
EXECUTE FUNCTION sync_approved_business_application_location();
