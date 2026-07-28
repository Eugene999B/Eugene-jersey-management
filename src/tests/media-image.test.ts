import { MediaKind } from "@prisma/client";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  isSupportedDecodedImageFormat,
  mediaCompressionProfile,
  optimizeUploadedImage,
} from "@/lib/media-image";

async function samplePng() {
  const width = 1800;
  const height = 1200;
  const pixels = Buffer.alloc(width * height * 3);
  for (let index = 0; index < pixels.length; index += 3) {
    const pixel = index / 3;
    pixels[index] = pixel % 251;
    pixels[index + 1] = Math.floor(pixel / width) % 241;
    pixels[index + 2] = (pixel * 17) % 239;
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

describe("durable compressed media", () => {
  it("recognizes common browser, phone, animated, document-image and vector formats", () => {
    for (const format of ["jpeg", "png", "webp", "avif", "gif", "tiff", "heif", "svg"]) {
      expect(isSupportedDecodedImageFormat(format)).toBe(true);
    }
    expect(isSupportedDecodedImageFormat("raw")).toBe(false);
    expect(isSupportedDecodedImageFormat("pdf")).toBe(false);
  });

  it("resizes and progressively compresses a product image to WebP outputs", async () => {
    const original = await samplePng();
    const result = await optimizeUploadedImage({ original, kind: MediaKind.PRODUCT });
    const profile = mediaCompressionProfile(MediaKind.PRODUCT);
    const metadata = await sharp(result.main).metadata();
    const thumbnailMetadata = await sharp(result.thumbnail).metadata();

    expect(result.originalFormat).toBe("png");
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBeLessThanOrEqual(profile.mainWidth);
    expect(metadata.height).toBeLessThanOrEqual(profile.mainHeight);
    expect(thumbnailMetadata.format).toBe("webp");
    expect(thumbnailMetadata.width).toBeLessThanOrEqual(profile.thumbWidth);
    expect(thumbnailMetadata.height).toBeLessThanOrEqual(profile.thumbHeight);
    expect(result.main.length).toBeLessThan(original.length);
    expect(result.thumbnail.length).toBeLessThan(result.main.length);
  });

  it("decodes SVG and stores a small rasterized logo rather than the original source", async () => {
    const original = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#0f766e"/><circle cx="600" cy="400" r="260" fill="#f97316"/></svg>`);
    const result = await optimizeUploadedImage({ original, kind: MediaKind.SHOP_LOGO });
    const profile = mediaCompressionProfile(MediaKind.SHOP_LOGO);
    const metadata = await sharp(result.main).metadata();

    expect(result.originalFormat).toBe("svg");
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBeLessThanOrEqual(profile.mainWidth);
    expect(metadata.height).toBeLessThanOrEqual(profile.mainHeight);
    expect(result.main.length).toBeLessThan(profile.mainTargetBytes);
  });
});
