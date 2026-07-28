import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("durable compressed media architecture", () => {
  it("stores only optimized WebP bytes in PostgreSQL and removes the Railway storage blocker", () => {
    const storage = source("../lib/media-storage.ts");
    const migration = source("../../prisma/migrations/20260728201500_database_media_bytes/migration.sql");

    expect(migration).toContain('ADD COLUMN "contentData" BYTEA');
    expect(migration).toContain('ADD COLUMN "thumbnailData" BYTEA');
    expect(storage).toContain('MEDIA_STORAGE_PROVIDER ?? "database"');
    expect(storage).toContain('return nodeEnv === "production" && allowEphemeral !== "true" ? "database" : "local"');
    expect(storage).toContain('SET "contentData" = ${input.optimized.main}, "thumbnailData" = ${input.optimized.thumbnail}');
    expect(storage).not.toContain("Production media uploads require S3/R2 storage");
    expect(storage).not.toContain('"contentData" = ${original}');
  });

  it("uses one compression service for product photos, shop logos and Design Studio raster artwork", () => {
    const catalog = source("../app/dashboard/catalog/actions.ts");
    const settings = source("../app/dashboard/settings/actions.ts");
    const uploads = source("../app/api/uploads/route.ts");
    const studio = source("../components/design/production-studio-advanced.tsx");

    expect(catalog).toContain("createOptimizedMediaAsset");
    expect(catalog).toContain("MediaKind.PRODUCT");
    expect(settings).toContain("createOptimizedMediaAsset");
    expect(settings).toContain("MediaKind.SHOP_LOGO");
    expect(uploads).toContain("MediaKind.DESIGN_ASSET");
    expect(studio).toContain('body.set("kind", "DESIGN_ASSET")');
    expect(studio).toContain('fetch("/api/uploads"');
  });

  it("serves database media immutably and allows large inputs only for server-side compression", () => {
    const route = source("../app/api/media/database/[id]/[variant]/route.ts");
    const config = source("../../next.config.ts");
    const settingsPage = source("../app/dashboard/settings/page.tsx");

    expect(route).toContain('"Cache-Control": "public, max-age=31536000, immutable"');
    expect(route).toContain('"X-Content-Type-Options": "nosniff"');
    expect(config).toContain('bodySizeLimit: "25mb"');
    expect(config).toContain('proxyClientMaxBodySize: "25mb"');
    expect(settingsPage).toContain("PostgreSQL compressed media ready");
    expect(settingsPage).toContain("large original is discarded");
    expect(settingsPage).not.toContain("Local storage is temporary on Railway");
  });
});
