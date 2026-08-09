CREATE TYPE "HeatPressRunStatus" AS ENUM ('READY', 'PRESSING', 'PAUSED', 'FIRST_PRESS_COMPLETE', 'PEEL_COMPLETE', 'REPRESSING', 'QUALITY_CHECK', 'PASSED', 'REWORK_REQUIRED');
CREATE TYPE "HeatPressTimerMode" AS ENUM ('FIRST_PRESS', 'REPRESS');
CREATE TYPE "HeatPressEventType" AS ENUM ('RUN_CREATED', 'TIMER_STARTED', 'TIMER_PAUSED', 'TIMER_RESET', 'FIRST_PRESS_COMPLETED', 'PEEL_COMPLETED', 'REPRESS_STARTED', 'REPRESS_COMPLETED', 'QUALITY_PASSED', 'REWORK_REQUIRED', 'PHOTO_ATTACHED');

CREATE TABLE "HeatPressRun" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "designProductionBriefId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "status" "HeatPressRunStatus" NOT NULL DEFAULT 'READY',
    "materialSnapshot" JSONB NOT NULL,
    "garmentSnapshot" JSONB NOT NULL,
    "placementSnapshot" JSONB NOT NULL,
    "pressTemperatureC" DOUBLE PRECISION NOT NULL,
    "pressDurationSeconds" DOUBLE PRECISION NOT NULL,
    "pressure" TEXT NOT NULL,
    "peelType" TEXT NOT NULL,
    "repressSeconds" DOUBLE PRECISION NOT NULL,
    "timerMode" "HeatPressTimerMode",
    "timerStartedAt" TIMESTAMP(3),
    "timerElapsedMs" INTEGER NOT NULL DEFAULT 0,
    "firstPressElapsedMs" INTEGER,
    "repressElapsedMs" INTEGER,
    "firstPressCompletedAt" TIMESTAMP(3),
    "peelCompletedAt" TIMESTAMP(3),
    "repressCompletedAt" TIMESTAMP(3),
    "qualityChecklist" JSONB,
    "qualityPassedAt" TIMESTAMP(3),
    "reworkReason" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HeatPressRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HeatPressEvent" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "heatPressRunId" TEXT NOT NULL,
    "type" "HeatPressEventType" NOT NULL,
    "timerMode" "HeatPressTimerMode",
    "elapsedMs" INTEGER,
    "note" TEXT,
    "metadata" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HeatPressEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HeatPressEvidence" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "heatPressRunId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteLength" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HeatPressEvidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HeatPressRun_shopId_designProductionBriefId_attemptNumber_key" ON "HeatPressRun"("shopId", "designProductionBriefId", "attemptNumber");
CREATE INDEX "HeatPressRun_shopId_status_updatedAt_idx" ON "HeatPressRun"("shopId", "status", "updatedAt");
CREATE INDEX "HeatPressRun_designProductionBriefId_updatedAt_idx" ON "HeatPressRun"("designProductionBriefId", "updatedAt");
CREATE INDEX "HeatPressEvent_shopId_heatPressRunId_createdAt_idx" ON "HeatPressEvent"("shopId", "heatPressRunId", "createdAt");
CREATE INDEX "HeatPressEvent_heatPressRunId_createdAt_idx" ON "HeatPressEvent"("heatPressRunId", "createdAt");
CREATE INDEX "HeatPressEvidence_shopId_heatPressRunId_createdAt_idx" ON "HeatPressEvidence"("shopId", "heatPressRunId", "createdAt");
CREATE INDEX "HeatPressEvidence_heatPressRunId_createdAt_idx" ON "HeatPressEvidence"("heatPressRunId", "createdAt");

ALTER TABLE "HeatPressRun" ADD CONSTRAINT "HeatPressRun_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HeatPressRun" ADD CONSTRAINT "HeatPressRun_designProductionBriefId_fkey" FOREIGN KEY ("designProductionBriefId") REFERENCES "DesignProductionBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HeatPressRun" ADD CONSTRAINT "HeatPressRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HeatPressRun" ADD CONSTRAINT "HeatPressRun_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HeatPressEvent" ADD CONSTRAINT "HeatPressEvent_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HeatPressEvent" ADD CONSTRAINT "HeatPressEvent_heatPressRunId_fkey" FOREIGN KEY ("heatPressRunId") REFERENCES "HeatPressRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HeatPressEvent" ADD CONSTRAINT "HeatPressEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HeatPressEvidence" ADD CONSTRAINT "HeatPressEvidence_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HeatPressEvidence" ADD CONSTRAINT "HeatPressEvidence_heatPressRunId_fkey" FOREIGN KEY ("heatPressRunId") REFERENCES "HeatPressRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HeatPressEvidence" ADD CONSTRAINT "HeatPressEvidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
