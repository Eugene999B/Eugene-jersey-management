-- Release #30: durable optimized media stored in PostgreSQL.
-- The original upload is never retained; these columns contain only the optimized WebP outputs.
ALTER TABLE "MediaAsset"
  ADD COLUMN "contentData" BYTEA,
  ADD COLUMN "thumbnailData" BYTEA;

CREATE INDEX "MediaAsset_database_content_idx"
  ON "MediaAsset" ("id")
  WHERE "contentData" IS NOT NULL;
