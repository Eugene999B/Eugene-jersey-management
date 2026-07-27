CREATE TABLE "DesignJobVersion" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "designJobId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "canvasJson" JSONB NOT NULL,
    "machineProfile" TEXT,
    "source" TEXT NOT NULL DEFAULT 'SAVE',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignJobVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DesignJobVersion_designJobId_versionNumber_key" ON "DesignJobVersion"("designJobId", "versionNumber");
CREATE INDEX "DesignJobVersion_shopId_createdAt_idx" ON "DesignJobVersion"("shopId", "createdAt");
CREATE INDEX "DesignJobVersion_designJobId_createdAt_idx" ON "DesignJobVersion"("designJobId", "createdAt");
CREATE INDEX "DesignJobVersion_createdById_createdAt_idx" ON "DesignJobVersion"("createdById", "createdAt");

ALTER TABLE "DesignJobVersion"
ADD CONSTRAINT "DesignJobVersion_shopId_fkey"
FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DesignJobVersion"
ADD CONSTRAINT "DesignJobVersion_designJobId_fkey"
FOREIGN KEY ("designJobId") REFERENCES "DesignJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DesignJobVersion"
ADD CONSTRAINT "DesignJobVersion_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
