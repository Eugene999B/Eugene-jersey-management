-- CreateTable
CREATE TABLE "ScheduledJobState" (
    "id" TEXT NOT NULL,
    "jobKey" TEXT NOT NULL,
    "lastStartedAt" TIMESTAMP(3),
    "lastSucceededAt" TIMESTAMP(3),
    "lastFailedAt" TIMESTAMP(3),
    "lastDurationMs" INTEGER,
    "lastResult" JSONB NOT NULL DEFAULT '{}',
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledJobState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledJobState_jobKey_key" ON "ScheduledJobState"("jobKey");

-- CreateIndex
CREATE INDEX "ScheduledJobState_lastSucceededAt_idx" ON "ScheduledJobState"("lastSucceededAt");

-- CreateIndex
CREATE INDEX "ScheduledJobState_lastFailedAt_idx" ON "ScheduledJobState"("lastFailedAt");
