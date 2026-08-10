-- Add durable per-device account sessions for workforce and buyer accounts.
CREATE TABLE "AccountSession" (
    "id" TEXT NOT NULL,
    "accountKind" "AccountKind" NOT NULL,
    "accountId" TEXT NOT NULL,
    "authVersion" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,

    CONSTRAINT "AccountSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AccountSession_accountKind_accountId_revokedAt_expiresAt_idx"
ON "AccountSession"("accountKind", "accountId", "revokedAt", "expiresAt");

CREATE INDEX "AccountSession_accountKind_accountId_authVersion_idx"
ON "AccountSession"("accountKind", "accountId", "authVersion");

CREATE INDEX "AccountSession_expiresAt_idx"
ON "AccountSession"("expiresAt");
