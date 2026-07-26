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
const maxUploadBytes = Math.max(1_000_000, Math.min(25_000_000, Number(process.env.MAX_IMAGE_UPLOAD_BYTES ?? 8 * 1024 * 1024)));
const maxInputPixels = Math.max(1_000_000, Math.min(100_000_000, Number(process.env.MAX_IMAGE_INPUT_PIXELS ?? 40_000_000)));

type MediaUploadInput = {
  file: File;
  shopId?: string | null;
  uploadedById?: string | null;
  kind?: MediaKind;
  altText?: string | null;
};
type StoredObject = { provider: StorageProvider; key: string; url: string };

function storageProvider() {
  const provider = (process.env.MEDIA_STORAGE_PROVIDER ?? "local").toLowerCase();
  if (provider === "r2") return StorageProvider.R2;
  if (provider === "s3") return StorageProvider.S3;
  return StorageProvider.LOCAL;
}

function assertProductionStorage(provider: StorageProvider) {
  if (process.env.NODE_ENV === "production" && provider === StorageProvider.LOCAL && process.env.ALLOW_EPHEMERAL_MEDIA !== "true") {
    throw new Error("Production media uploads require S3/R2 storage. Set MEDIA_STORAGE_PROVIDER=r2 or s3. Local Railway storage is ephemeral.");
  }
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

async function storeObject(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
  const provider = storageProvider();
  assertProductionStorage(provider);
  if (provider === StorageProvider.LOCAL) {
    const root = localMediaRoot();
    const target = path.resolve(root, key);
    const relative = path.relative(root, target);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Invalid local media key.");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body, { flag: "wx" });
    return { provider, key, url: publicMediaUrl(key) };
  }

  const bucket = process.env.S3_BUCKET ?? process.env.R2_BUCKET;
  if (!bucket) throw new Error("S3/R2 bucket is missing.");
  if (!process.env.MEDIA_PUBLIC_URL) throw new Error("MEDIA_PUBLIC_URL is required for S3/R2 uploads.");
  await s3Client().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" }));
  return { provider, key, url: publicMediaUrl(key) };
}

export async function readLocalMedia(keyParts: string[]) {
  if (storageProvider() !== StorageProvider.LOCAL) return null;
  const key = keyParts.join("/");
  if (!key || key.includes("\0")) return null;
  const root = localMediaRoot();
  const filePath = path.resolve(root, key);
  const relative = path.relative(root, filePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return readFile(filePath).catch(() => null);
}

export async function createOptimizedMediaAsset(input: MediaUploadInput) {
  if (!input.file || input.file.size <= 0) return null;
  assertProductionStorage(storageProvider());
  if (input.file.size > maxUploadBytes) throw new Error(`Image is too large. Maximum allowed size is ${Math.round(maxUploadBytes / 1024 / 1024)}MB.`);
  if (!allowedImageTypes.has(input.file.type)) throw new Error("Only JPG, PNG, WebP, and AVIF images are allowed.");

  const original = Buffer.from(await input.file.arrayBuffer());
  const originalMetadata = await sharp(original, { limitInputPixels: maxInputPixels }).metadata();
  if (!originalMetadata.width || !originalMetadata.height || originalMetadata.width * originalMetadata.height > maxInputPixels) {
    throw new Error("Image dimensions are invalid or too large.");
  }

  const checksum = createHash("sha256").update(original).digest("hex");
  const optimized = await sharp(original, { limitInputPixels: maxInputPixels }).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const thumb = await sharp(original, { limitInputPixels: maxInputPixels }).rotate().resize({ width: 480, height: 480, fit: "cover", withoutEnlargement: false }).webp({ quality: 76 }).toBuffer();
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
      originalName: input.file.name.slice(0, 200),
      mimeType: "image/webp",
      width: metadata.width,
      height: metadata.height,
      sizeBytes: optimized.length,
      checksum,
    } satisfies Prisma.MediaAssetUncheckedCreateInput,
  });
}
