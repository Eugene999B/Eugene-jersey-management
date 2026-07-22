import "server-only";

import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { MediaKind, StorageProvider, type Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import sharp from "sharp";
import { prisma } from "@/lib/db";

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const maxUploadBytes = Number(process.env.MAX_IMAGE_UPLOAD_BYTES ?? 8 * 1024 * 1024);

type MediaUploadInput = {
  file: File;
  shopId?: string | null;
  uploadedById?: string | null;
  kind?: MediaKind;
  altText?: string | null;
};

type StoredObject = {
  provider: StorageProvider;
  key: string;
  url: string;
};

function storageProvider() {
  const provider = (process.env.MEDIA_STORAGE_PROVIDER ?? "local").toLowerCase();
  if (provider === "r2") return StorageProvider.R2;
  if (provider === "s3") return StorageProvider.S3;
  return StorageProvider.LOCAL;
}

function localMediaRoot() {
  const configured = process.env.LOCAL_MEDIA_DIR?.trim();
  if (configured && path.isAbsolute(configured)) return path.normalize(configured);
  return path.join(tmpdir(), "eugene-jersey-media");
}

function publicMediaUrl(key: string) {
  const base = process.env.MEDIA_PUBLIC_URL?.replace(/\/$/, "");
  if (base) return `${base}/${key}`;
  return `/api/media/local/${key}`;
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

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("S3/R2 storage is selected but endpoint or credentials are missing.");
  }

  return new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
}

async function storeObject(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
  const provider = storageProvider();
  if (provider === StorageProvider.LOCAL) {
    const target = path.join(localMediaRoot(), key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
    return { provider, key, url: publicMediaUrl(key) };
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

  return { provider, key, url: publicMediaUrl(key) };
}

export async function readLocalMedia(keyParts: string[]) {
  const key = keyParts.join("/");
  if (!key || key.includes("..") || path.isAbsolute(key)) return null;
  const filePath = path.join(localMediaRoot(), key);
  if (!filePath.startsWith(localMediaRoot())) return null;
  return readFile(filePath);
}

export async function createOptimizedMediaAsset(input: MediaUploadInput) {
  if (!input.file || input.file.size <= 0) return null;
  if (input.file.size > maxUploadBytes) {
    throw new Error(`Image is too large. Maximum allowed size is ${Math.round(maxUploadBytes / 1024 / 1024)}MB.`);
  }
  if (!allowedImageTypes.has(input.file.type)) {
    throw new Error("Only JPG, PNG, WebP, and AVIF images are allowed.");
  }

  const original = Buffer.from(await input.file.arrayBuffer());
  const checksum = createHash("sha256").update(original).digest("hex");
  const optimized = await sharp(original)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  const thumb = await sharp(original)
    .rotate()
    .resize({ width: 480, height: 480, fit: "cover", withoutEnlargement: false })
    .webp({ quality: 76 })
    .toBuffer();
  const metadata = await sharp(optimized).metadata();
  const kind = input.kind ?? MediaKind.PRODUCT;
  const id = nanoid(16);
  const base = safeKey({ shopId: input.shopId, kind, suffix: id });
  const main = await storeObject(`${base}.webp`, optimized, "image/webp");
  const thumbnail = await storeObject(`${base}-thumb.webp`, thumb, "image/webp");

  return prisma.mediaAsset.create({
    data: {
      shopId: input.shopId ?? null,
      uploadedById: input.uploadedById ?? null,
      kind,
      provider: main.provider,
      key: main.key,
      url: main.url,
      thumbnailUrl: thumbnail.url,
      originalName: input.file.name,
      mimeType: "image/webp",
      width: metadata.width,
      height: metadata.height,
      sizeBytes: optimized.length,
      checksum,
    } satisfies Prisma.MediaAssetUncheckedCreateInput,
  });
}
