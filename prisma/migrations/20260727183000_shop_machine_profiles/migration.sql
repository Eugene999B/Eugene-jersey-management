CREATE TABLE "ShopMachineProfile" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "outputFormat" TEXT NOT NULL DEFAULT 'SVG_CUT',
    "bedWidthMm" DOUBLE PRECISION NOT NULL DEFAULT 305,
    "bedHeightMm" DOUBLE PRECISION NOT NULL DEFAULT 508,
    "unitsPerMm" INTEGER NOT NULL DEFAULT 40,
    "baudRate" INTEGER NOT NULL DEFAULT 9600,
    "origin" TEXT NOT NULL DEFAULT 'BOTTOM_LEFT',
    "mirrorDefault" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopMachineProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShopMachineProfile_shopId_name_key" ON "ShopMachineProfile"("shopId", "name");
CREATE INDEX "ShopMachineProfile_shopId_isActive_idx" ON "ShopMachineProfile"("shopId", "isActive");
CREATE INDEX "ShopMachineProfile_shopId_isDefault_idx" ON "ShopMachineProfile"("shopId", "isDefault");
CREATE UNIQUE INDEX "ShopMachineProfile_one_default_per_shop" ON "ShopMachineProfile"("shopId") WHERE "isDefault" = true;

ALTER TABLE "ShopMachineProfile"
ADD CONSTRAINT "ShopMachineProfile_shopId_fkey"
FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ShopMachineProfile" (
    "id",
    "shopId",
    "name",
    "outputFormat",
    "bedWidthMm",
    "bedHeightMm",
    "unitsPerMm",
    "baudRate",
    "origin",
    "mirrorDefault",
    "isDefault",
    "isActive",
    "createdAt",
    "updatedAt"
)
SELECT
    'machine_' || md5("id" || ':generic-svg'),
    "id",
    'Generic SVG cutter',
    'SVG_CUT',
    305,
    508,
    40,
    9600,
    'BOTTOM_LEFT',
    true,
    true,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Shop"
ON CONFLICT ("shopId", "name") DO NOTHING;
