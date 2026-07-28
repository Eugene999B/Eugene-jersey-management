import { NextRequest, NextResponse } from "next/server";
import { readDatabaseMedia } from "@/lib/media-storage";

type Props = {
  params: Promise<{ id: string; variant: string }>;
};

export async function GET(request: NextRequest, { params }: Props) {
  const { id, variant } = await params;
  if (variant !== "main" && variant !== "thumb") return new NextResponse(null, { status: 404 });

  const media = await readDatabaseMedia(id, variant);
  if (!media) return new NextResponse(null, { status: 404 });
  if (request.headers.get("if-none-match") === media.etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: media.etag,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  return new NextResponse(media.body, {
    headers: {
      "Content-Type": media.mimeType,
      "Content-Length": String(media.body.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: media.etag,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
