CREATE TYPE "DesignProductionBriefStatus" AS ENUM ('DRAFT', 'REVIEWED');

CREATE TABLE "DesignProductionBrief" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "designJobId" TEXT NOT NULL,
    "garmentId" TEXT NOT NULL,
    "garmentSize" TEXT NOT NULL,
    "placementId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "garmentSnapshot" JSONB NOT NULL,
    "placementSnapshot" JSONB NOT NULL,
    "materialSnapshot" JSONB NOT NULL,
    "cutSheetWidthMm" DOUBLE PRECISION NOT NULL,
    "cutSheetHeightMm" DOUBLE PRECISION NOT NULL,
    "artworkWidthMm" DOUBLE PRECISION NOT NULL,
    "artworkHeightMm" DOUBLE PRECISION NOT NULL,
    "placementWidthMm" DOUBLE PRECISION NOT NULL,
    "placementHeightMm" DOUBLE PRECISION NOT NULL,
    "materialWidthMm" DOUBLE PRECISION NOT NULL,
    "mirror" BOOLEAN NOT NULL,
    "status" "DesignProductionBriefStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignProductionBrief_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DesignProductionBrief_shopId_designJobId_key" ON "DesignProductionBrief"("shopId", "designJobId");
CREATE INDEX "DesignProductionBrief_shopId_status_updatedAt_idx" ON "DesignProductionBrief"("shopId", "status", "updatedAt");
CREATE INDEX "DesignProductionBrief_designJobId_idx" ON "DesignProductionBrief"("designJobId");

ALTER TABLE "DesignProductionBrief"
ADD CONSTRAINT "DesignProductionBrief_shopId_fkey"
FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DesignProductionBrief"
ADD CONSTRAINT "DesignProductionBrief_designJobId_fkey"
FOREIGN KEY ("designJobId") REFERENCES "DesignJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DesignProductionBrief"
ADD CONSTRAINT "DesignProductionBrief_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DesignProductionBrief"
ADD CONSTRAINT "DesignProductionBrief_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
