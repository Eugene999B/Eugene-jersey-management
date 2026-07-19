import { NextRequest, NextResponse } from "next/server";
import { readLocalMedia } from "@/lib/media-storage";

type Props = {
  params: Promise<{ path: string[] }>;
};

export async function GET(_request: NextRequest, { params }: Props) {
  const { path } = await params;
  const file = await readLocalMedia(path);
  if (!file) return new NextResponse(null, { status: 404 });

  return new NextResponse(file, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
