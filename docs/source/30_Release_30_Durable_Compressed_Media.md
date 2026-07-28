# Release #30 — Durable Compressed Media

Updated: 2026-07-28

## Purpose

Remove the production upload failure caused by ephemeral Railway disk storage and provide one durable image pipeline for Design Studio artwork, shop logos and product photos.

## Required behaviour

1. The application accepts common browser and phone image formats that the installed Sharp decoder can safely read, including JPEG/JPG, PNG, WebP, AVIF, GIF, TIFF, HEIC/HEIF and SVG.
2. The server validates the decoded image rather than trusting only the browser MIME type or file extension.
3. EXIF rotation is applied automatically.
4. Animated images use a safe still frame for the stored shop asset.
5. Large uploads are resized and repeatedly compressed until they meet the per-purpose storage target.
6. Only the optimized WebP image and optimized thumbnail are persisted. The large original upload is never retained.
7. PostgreSQL is the default durable provider, so production does not depend on Railway's ephemeral filesystem and does not require S3 or R2.
8. S3 and R2 remain optional for businesses that later choose external object storage.
9. Every media record remains associated with the exact shop and uploader.
10. Existing local, S3 and R2 media URLs continue to work.

## Compression targets

- shop logos: maximum 800 px, target approximately 160 KB
- product photos: maximum 1400 px, target approximately 280 KB
- Design Studio raster artwork: maximum 2000 px, target approximately 600 KB
- credentials and other evidence images: maximum 1800 px, target approximately 450 KB
- thumbnails: purpose-sized WebP, normally below 90 KB

The targets are upper goals rather than promises for every possible image. The encoder lowers quality and dimensions progressively while protecting readability and production usefulness.

## Safety boundaries

- Camera RAW, Photoshop, PDF and arbitrary binary files are not treated as images.
- Image dimensions and decoded pixels remain capped to prevent decompression bombs.
- Upload request size remains capped even though the stored result is much smaller.
- SVG is decoded by the server for normal media uploads. Design Studio may continue preserving a small embedded SVG where vector cutter geometry is required.
- Public media URLs contain unpredictable asset identifiers and return immutable cache headers.

## Validation gates

- ordered PostgreSQL migration
- compression and format-detection unit tests
- database-byte persistence and serving tests
- upload permission and tenant-isolation checks
- shop logo upload browser journey
- product photo upload browser journey
- Design Studio raster import browser journey
- lint, TypeScript, complete unit suite, production build and all Chromium journeys
