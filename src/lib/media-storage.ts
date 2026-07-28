import "server-only";

import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { MediaKind, StorageProvider, type Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/db";
import {
  DEFAULT_MAX_IMAGE_INPUT_PIXELS,
  DEFAULT_MAX_IMAGE_UPLOAD_BYTES,
  optimizeUploadedImage,
} from "@/lib/media-image";

const maxUploadBytes = Math.max(
  1_000_000,
  Math.min(50_000_000, Number(process.env.MAX_IMAGE_UPLOAD_BYTES ?? DEFAULT_MAX_IMAGE_UPLOAD_BYTES)),
);
const maxInputPixels = Math.max(
  1_000_000,
  Math.min(100_000_000, Number(process.env.MAX_IMAGE_INPUT_PIXELS ?? DEFAULT_MAX_IMAGE_INPUT_PIXELS)),
);

type MediaUploadInput = {
  file: File;
  shopId?: string | null;
  uploadedById?: string | null;
  kind?: MediaKind;
  altText?: string | null;
};
type ExternalStoredObject = { provider: StorageProvider; key: string; url: string };
export type MediaStorageMode = "database" | "local" | "r2" | "s3";

export function resolveMediaStorageMode(input: {
  configured?: string | null;
  nodeEnv?: string | null;
  allowEphemeral?: string | null;
} = {}): MediaStorageMode {
  const configured = (input.configured ?? process.env.MEDIA_STORAGE_PROVIDER ?? "database").trim().toLowerCase();
  const nodeEnv = input.nodeEnv ?? process.env.NODE_ENV;
  const allowEphemeral = input.allowEphemeral ?? process.env.ALLOW_EPHEMERAL_MEDIA;
  if (configured === "r2") return "r2";
  if (configured === "s3") return "s3";
  if (configured === "local") {
    return nodeEnv === "production" && allowEphemeral !== "true" ? "database" : "local";
  }
  return "database";
}

function localMediaRoot() {
  const configured = process.env.LOCAL_MEDIA_DIR?.trim();
  if (configured && path.isAbsolute(configured)) return path.resolve(configured);
  return path.resolve(tmpdir(), "eugene-jersey-media");
}

function publicMediaUrl(key: string) {
  const base = process.env.MEDIA_PUBLIC_URL?.replace(/\/$/, "");
  if (base) {
    const url = new URL(`${base}/${key}`);
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("MEDIA_PUBLIC_URL must use HTTPS in production.");
    return url.toString();
  }
  return `/api/media/local/${key}`;
}

function databaseMediaUrl(id: string, variant: "main" | "thumb") {
  return `/api/media/database/${encodeURIComponent(id)}/${variant}`;
}

function safeKey(input: { shopId?: string | null; kind: MediaKind; suffix: string }) {
  const shopPart = (input.shopId ?? "platform").replace(/[^a-zA-Z0-9_-]/g, "");
  return `${shopPart}/${input.kind.toLowerCase()}/${input.suffix}`;
}

function s3Client() {
  const endpoint = process.env.S3_ENDPOINT ?? process.env.R2_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID ?? process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY ?? process.env.R2_SECRET_ACCESS_KEY;
  const region = process.env.S3_REGION ?? process.env.R2_REGION ?? "auto";
  if (!endpoint || !accessKeyId || !secretAccessKey) throw new Error("S3/R2 storage is selected but endpoint or credentials are missing.");
  return new S3Client({ endpoint, region, credentials: { accessKeyId, secretAccessKey }, forcePathStyle: true });
}

async function storeExternalObject(mode: Exclude<MediaStorageMode, "database">, key: string, body: Buffer, contentType: string): Promise<ExternalStoredObject> {
  if (mode === "local") {
    const root = localMediaRoot();
    const target = path.resolve(root, key);
    const relative = path.relative(root, target);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Invalid local media key.");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body, { flag: "wx" });
    return { provider: StorageProvider.LOCAL, key, url: publicMediaUrl(key) };
  }

  const bucket = process.env.S3_BUCKET ?? process.env.R2_BUCKET;
  if (!bucket) throw new Error("S3/R2 bucket is missing.");
  if (!process.env.MEDIA_PUBLIC_URL) throw new Error("MEDIA_PUBLIC_URL is required for S3/R2 uploads.");
  await s3Client().send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));
  return {
    provider: mode === "r2" ? StorageProvider.R2 : StorageProvider.S3,
    key,
    url: publicMediaUrl(key),
  };
}

export async function readLocalMedia(keyParts: string[]) {
  if (resolveMediaStorageMode() !== "local") return null;
  const key = keyParts.join("/");
  if (!key || key.includes("\0")) return null;
  const root = localMediaRoot();
  const filePath = path.resolve(root, key);
  const relative = path.relative(root, filePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return readFile(filePath).catch(() => null);
}

export async function readDatabaseMedia(id: string, variant: "main" | "thumb") {
  if (!/^[A-Za-z0-9_-]{12,100}$/.test(id)) return null;
  const rows = await prisma.$queryRaw<Array<{
    mimeType: string;
    checksum: string | null;
    contentData: Uint8Array | null;
    thumbnailData: Uint8Array | null;
  }>>`
    SELECT "mimeType", "checksum", "contentData", "thumbnailData"
    FROM "MediaAsset"
    WHERE "id" = ${id}
    LIMIT 1
  `;
  const row = rows[0];
  const data = variant === "thumb" ? row?.thumbnailData : row?.contentData;
  if (!row || !data) return null;
  return {
    body: Buffer.from(data),
    mimeType: row.mimeType || "image/webp",
    etag: `"${row.checksum ?? id}-${variant}"`,
  };
}

async function createDatabaseAsset(input: {
  id: string;
  upload: MediaUploadInput;
  kind: MediaKind;
  checksum: string;
  optimized: Awaited<ReturnType<typeof optimizeUploadedImage>>;
}) {
  const url = databaseMediaUrl(input.id, "main");
  const thumbnailUrl = databaseMediaUrl(input.id, "thumb");
  return prisma.$transaction(async (transaction) => {
    const asset = await transaction.mediaAsset.create({
      data: {
        id: input.id,
        shopId: input.upload.shopId ?? null,
        uploadedById: input.upload.uploadedById ?? null,
        kind: input.kind,
        provider: StorageProvider.LOCAL,
        key: `database/${input.id}/main.webp`,
        url,
        thumbnailUrl,
        originalName: input.upload.file.name.slice(0, 200),
        mimeType: "image/webp",
        width: input.optimized.width,
        height: input.optimized.height,
        sizeBytes: input.optimized.main.length,
        checksum: input.checksum,
      } satisfies Prisma.MediaAssetUncheckedCreateInput,
    });
    await transaction.$executeRaw`
      UPDATE "MediaAsset"
      SET "contentData" = ${input.optimized.main}, "thumbnailData" = ${input.optimized.thumbnail}
      WHERE "id" = ${input.id}
    `;
    return asset;
  });
}

export async function createOptimizedMediaAsset(input: MediaUploadInput) {
  if (!input.file || input.file.size <= 0) return null;
  if (input.file.size > maxUploadBytes) {
    throw new Error(`Image is too large to process. Maximum upload size is ${Math.round(maxUploadBytes / 1024 / 1024)} MB.`);
  }

  const original = Buffer.from(await input.file.arrayBuffer());
  const kind = input.kind ?? MediaKind.PRODUCT;
  const checksum = createHash("sha256").update(original).digest("hex");
  let optimized: Awaited<ReturnType<typeof optimizeUploadedImage>>;
  try {
    optimized = await optimizeUploadedImage({ original, kind, maxInputPixels });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unsupported image format")) throw error;
    throw new Error(error instanceof Error && error.message.includes("dimensions")
      ? error.message
      : "This file could not be decoded as a safe image. Use JPG, PNG, WebP, AVIF, GIF, TIFF, HEIC/HEIF, or SVG.");
  }

  const mode = resolveMediaStorageMode();
  const id = nanoid(20);
  if (mode === "database") {
    return createDatabaseAsset({ id, upload: input, kind, checksum, optimized });
  }

  const base = safeKey({ shopId: input.shopId, kind, suffix: id });
  const [main, thumbnail] = await Promise.all([
    storeExternalObject(mode, `${base}.webp`, optimized.main, "image/webp"),
    storeExternalObject(mode, `${base}-thumb.webp`, optimized.thumbnail, "image/webp"),
  ]);

  return prisma.mediaAsset.create({
    data: {
      id,
      shopId: input.shopId ?? null,
      uploadedById: input.uploadedById ?? null,
      kind,
      provider: main.provider,
      key: main.key,
      url: main.url,
      thumbnailUrl: thumbnail.url,
      originalName: input.file.name.slice(0, 200),
      mimeType: "image/webp",
      width: optimized.width,
      height: optimized.height,
      sizeBytes: optimized.main.length,
      checksum,
    } satisfies Prisma.MediaAssetUncheckedCreateInput,
  });
}
