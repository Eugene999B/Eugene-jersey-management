CREATE TYPE "PasswordRecoveryChannel" AS ENUM ('SMS', 'EMAIL');
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DELIVERED', 'DELAYED', 'BOUNCED', 'FAILED');

CREATE TABLE "PasswordRecoveryChallenge" (
  "id" TEXT NOT NULL,
  "publicTokenHash" TEXT NOT NULL,
  "accountKind" "AccountKind" NOT NULL,
  "accountId" TEXT NOT NULL,
  "channel" "PasswordRecoveryChannel" NOT NULL,
  "destination" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "usedAt" TIMESTAMP(3),
  "providerReference" TEXT,
  "deliveryStatus" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "deliveryDetail" TEXT,
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PasswordRecoveryChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordRecoveryChallenge_publicTokenHash_key" ON "PasswordRecoveryChallenge"("publicTokenHash");
CREATE INDEX "PasswordRecoveryChallenge_accountKind_accountId_createdAt_idx" ON "PasswordRecoveryChallenge"("accountKind", "accountId", "createdAt");
CREATE INDEX "PasswordRecoveryChallenge_providerReference_idx" ON "PasswordRecoveryChallenge"("providerReference");
CREATE INDEX "PasswordRecoveryChallenge_expiresAt_usedAt_idx" ON "PasswordRecoveryChallenge"("expiresAt", "usedAt");

CREATE TABLE "EmailProviderEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "providerReference" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmailProviderEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailProviderEvent_provider_eventId_key" ON "EmailProviderEvent"("provider", "eventId");
CREATE INDEX "EmailProviderEvent_providerReference_occurredAt_idx" ON "EmailProviderEvent"("providerReference", "occurredAt");
CREATE INDEX "EmailProviderEvent_eventType_occurredAt_idx" ON "EmailProviderEvent"("eventType", "occurredAt");

ALTER TABLE "BuyerEmailVerification"
  ADD COLUMN "deliveryStatus" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "deliveryDetail" TEXT,
  ADD COLUMN "deliveredAt" TIMESTAMP(3);