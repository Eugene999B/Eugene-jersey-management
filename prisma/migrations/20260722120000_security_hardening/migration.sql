ALTER TABLE "User"
ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "PhoneVerificationCode"
ADD COLUMN "pendingName" TEXT,
ADD COLUMN "pendingEmail" TEXT,
ADD COLUMN "pendingPasswordHash" TEXT;

UPDATE "Order"
SET "publicAccessToken" = md5(random()::text || clock_timestamp()::text || "id") || md5("id" || random()::text)
WHERE "publicAccessToken" IS NULL;

ALTER TABLE "Order"
ALTER COLUMN "publicAccessToken" SET NOT NULL,
ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");
