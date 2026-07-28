import { MediaKind } from "@prisma/client";
import sharp from "sharp";

export const DEFAULT_MAX_IMAGE_UPLOAD_BYTES = 20 * 1024 * 1024;
export const DEFAULT_MAX_IMAGE_INPUT_PIXELS = 50_000_000;

const supportedFormats = new Set([
  "jpeg",
  "png",
  "webp",
  "avif",
  "gif",
  "tiff",
  "heif",
  "svg",
]);

export type MediaCompressionProfile = {
  mainWidth: number;
  mainHeight: number;
  mainQuality: number;
  mainTargetBytes: number;
  thumbWidth: number;
  thumbHeight: number;
  thumbQuality: number;
  thumbTargetBytes: number;
  thumbFit: "inside" | "cover";
};

const profiles: Record<MediaKind, MediaCompressionProfile> = {
  [MediaKind.SHOP_LOGO]: {
    mainWidth: 800,
    mainHeight: 800,
    mainQuality: 82,
    mainTargetBytes: 160_000,
    thumbWidth: 240,
    thumbHeight: 240,
    thumbQuality: 74,
    thumbTargetBytes: 45_000,
    thumbFit: "inside",
  },
  [MediaKind.PRODUCT]: {
    mainWidth: 1400,
    mainHeight: 1400,
    mainQuality: 78,
    mainTargetBytes: 280_000,
    thumbWidth: 480,
    thumbHeight: 480,
    thumbQuality: 70,
    thumbTargetBytes: 85_000,
    thumbFit: "cover",
  },
  [MediaKind.DESIGN_ASSET]: {
    mainWidth: 2000,
    mainHeight: 2000,
    mainQuality: 82,
    mainTargetBytes: 600_000,
    thumbWidth: 520,
    thumbHeight: 520,
    thumbQuality: 72,
    thumbTargetBytes: 95_000,
    thumbFit: "inside",
  },
  [MediaKind.SHOP_CREDENTIAL]: {
    mainWidth: 1800,
    mainHeight: 1800,
    mainQuality: 82,
    mainTargetBytes: 450_000,
    thumbWidth: 520,
    thumbHeight: 520,
    thumbQuality: 72,
    thumbTargetBytes: 95_000,
    thumbFit: "inside",
  },
  [MediaKind.RECEIPT]: {
    mainWidth: 1600,
    mainHeight: 2200,
    mainQuality: 78,
    mainTargetBytes: 360_000,
    thumbWidth: 480,
    thumbHeight: 640,
    thumbQuality: 68,
    thumbTargetBytes: 85_000,
    thumbFit: "inside",
  },
  [MediaKind.EXPORT]: {
    mainWidth: 1800,
    mainHeight: 1800,
    mainQuality: 80,
    mainTargetBytes: 450_000,
    thumbWidth: 480,
    thumbHeight: 480,
    thumbQuality: 70,
    thumbTargetBytes: 85_000,
    thumbFit: "inside",
  },
  [MediaKind.CUSTOMER_UPLOAD]: {
    mainWidth: 1800,
    mainHeight: 1800,
    mainQuality: 80,
    mainTargetBytes: 450_000,
    thumbWidth: 480,
    thumbHeight: 480,
    thumbQuality: 70,
    thumbTargetBytes: 85_000,
    thumbFit: "inside",
  },
};

export function mediaCompressionProfile(kind: MediaKind) {
  return profiles[kind] ?? profiles[MediaKind.PRODUCT];
}

export function isSupportedDecodedImageFormat(format: string | undefined) {
  return Boolean(format && supportedFormats.has(format.toLowerCase()));
}

function encoderQuality(initial: number, attempt: number) {
  return Math.max(48, initial - attempt * 7);
}

function encoderScale(attempt: number) {
  return attempt < 4 ? 1 : 0.86 ** (attempt - 3);
}

async function encodeWebp(input: Buffer, options: {
  width: number;
  height: number;
  quality: number;
  targetBytes: number;
  fit: "inside" | "cover";
  maxInputPixels: number;
}) {
  let selected: Buffer | null = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const scale = encoderScale(attempt);
    const quality = encoderQuality(options.quality, attempt);
    selected = await sharp(input, {
      limitInputPixels: options.maxInputPixels,
      failOn: "error",
      animated: false,
      density: 144,
    })
      .rotate()
      .resize({
        width: Math.max(160, Math.round(options.width * scale)),
        height: Math.max(160, Math.round(options.height * scale)),
        fit: options.fit,
        withoutEnlargement: true,
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .webp({
        quality,
        alphaQuality: Math.max(60, quality),
        effort: 4,
        smartSubsample: true,
      })
      .toBuffer();

    if (selected.length <= options.targetBytes) return selected;
  }
  if (!selected) throw new Error("Image optimization did not produce an output.");
  return selected;
}

export async function optimizeUploadedImage(input: {
  original: Buffer;
  kind: MediaKind;
  maxInputPixels?: number;
}) {
  const maxInputPixels = input.maxInputPixels ?? DEFAULT_MAX_IMAGE_INPUT_PIXELS;
  const metadata = await sharp(input.original, {
    limitInputPixels: maxInputPixels,
    failOn: "error",
    animated: false,
    density: 144,
  }).metadata();

  if (!isSupportedDecodedImageFormat(metadata.format)) {
    throw new Error("Unsupported image format. Use JPG, PNG, WebP, AVIF, GIF, TIFF, HEIC/HEIF, or SVG.");
  }
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > maxInputPixels) {
    throw new Error("Image dimensions are invalid or too large.");
  }

  const profile = mediaCompressionProfile(input.kind);
  const [main, thumbnail] = await Promise.all([
    encodeWebp(input.original, {
      width: profile.mainWidth,
      height: profile.mainHeight,
      quality: profile.mainQuality,
      targetBytes: profile.mainTargetBytes,
      fit: "inside",
      maxInputPixels,
    }),
    encodeWebp(input.original, {
      width: profile.thumbWidth,
      height: profile.thumbHeight,
      quality: profile.thumbQuality,
      targetBytes: profile.thumbTargetBytes,
      fit: profile.thumbFit,
      maxInputPixels,
    }),
  ]);

  const optimizedMetadata = await sharp(main).metadata();
  return {
    originalFormat: metadata.format,
    originalWidth: metadata.width,
    originalHeight: metadata.height,
    main,
    thumbnail,
    width: optimizedMetadata.width ?? null,
    height: optimizedMetadata.height ?? null,
    profile,
  };
}
