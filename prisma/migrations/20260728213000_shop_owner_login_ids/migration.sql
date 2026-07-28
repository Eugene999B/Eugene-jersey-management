-- Make the shop owner Login ID authenticate against the owner user record.
-- Existing IDs are copied only when the target user has no Login ID and the value is not already used.
UPDATE "User" AS owner
SET "adminLoginId" = shop."staffLoginId",
    "updatedAt" = CURRENT_TIMESTAMP
FROM "Shop" AS shop
WHERE owner."shopId" = shop."id"
  AND owner."role" = 'OWNER'
  AND owner."adminLoginId" IS NULL
  AND shop."staffLoginId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "User" AS existing
    WHERE existing."adminLoginId" = shop."staffLoginId"
  );
