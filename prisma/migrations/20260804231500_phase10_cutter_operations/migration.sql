CREATE TABLE "MachineProductionJob" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "designJobId" TEXT NOT NULL,
  "machineProfileId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "jobName" TEXT NOT NULL,
  "material" TEXT NOT NULL,
  "materialWidthMm" DOUBLE PRECISION NOT NULL,
  "sheetWidthMm" DOUBLE PRECISION NOT NULL,
  "sheetHeightMm" DOUBLE PRECISION NOT NULL,
  "mirror" BOOLEAN NOT NULL,
  "origin" TEXT NOT NULL,
  "copies" INTEGER NOT NULL DEFAULT 1,
  "outputFormat" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "pathCount" INTEGER NOT NULL,
  "byteLength" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PREPARED',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "deviceSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "checklist" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "warnings" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "claimedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MachineProductionJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MachineProductionAttempt" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "deviceInfo" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "error" TEXT,
  "byteLength" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "MachineProductionAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MachineProductionJob_shopId_status_createdAt_idx"
  ON "MachineProductionJob"("shopId", "status", "createdAt" DESC);
CREATE INDEX "MachineProductionJob_shopId_machineProfileId_createdAt_idx"
  ON "MachineProductionJob"("shopId", "machineProfileId", "createdAt" DESC);
CREATE INDEX "MachineProductionJob_shopId_payloadHash_sentAt_idx"
  ON "MachineProductionJob"("shopId", "payloadHash", "sentAt" DESC);
CREATE UNIQUE INDEX "MachineProductionAttempt_jobId_attemptNumber_key"
  ON "MachineProductionAttempt"("jobId", "attemptNumber");
CREATE INDEX "MachineProductionAttempt_shopId_startedAt_idx"
  ON "MachineProductionAttempt"("shopId", "startedAt" DESC);

ALTER TABLE "MachineProductionJob"
  ADD CONSTRAINT "MachineProductionJob_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MachineProductionJob"
  ADD CONSTRAINT "MachineProductionJob_designJobId_fkey"
  FOREIGN KEY ("designJobId") REFERENCES "DesignJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MachineProductionJob"
  ADD CONSTRAINT "MachineProductionJob_machineProfileId_fkey"
  FOREIGN KEY ("machineProfileId") REFERENCES "ShopMachineProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MachineProductionJob"
  ADD CONSTRAINT "MachineProductionJob_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MachineProductionAttempt"
  ADD CONSTRAINT "MachineProductionAttempt_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MachineProductionAttempt"
  ADD CONSTRAINT "MachineProductionAttempt_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "MachineProductionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MachineProductionAttempt"
  ADD CONSTRAINT "MachineProductionAttempt_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MachineProductionJob"
  ADD CONSTRAINT "MachineProductionJob_status_check"
  CHECK ("status" IN ('PREPARED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED'));
ALTER TABLE "MachineProductionJob"
  ADD CONSTRAINT "MachineProductionJob_output_check"
  CHECK ("outputFormat" = 'HPGL');
ALTER TABLE "MachineProductionJob"
  ADD CONSTRAINT "MachineProductionJob_dimensions_check"
  CHECK (
    "materialWidthMm" >= 20 AND "materialWidthMm" <= 2000
    AND "sheetWidthMm" >= 20 AND "sheetWidthMm" <= 2000
    AND "sheetHeightMm" >= 20 AND "sheetHeightMm" <= 5000
    AND "copies" = 1
    AND "pathCount" > 0
    AND "byteLength" > 0
  );
ALTER TABLE "MachineProductionAttempt"
  ADD CONSTRAINT "MachineProductionAttempt_status_check"
  CHECK ("status" IN ('STARTED', 'SENT', 'FAILED'));
