import { NextRequest, NextResponse } from "next/server";
import { MediaKind } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { createOptimizedMediaAsset } from "@/lib/media-storage";
import { enforceRateLimit } from "@/lib/rate-limit";

function parseKind(value: FormDataEntryValue | null) {
  const raw = String(value ?? "PRODUCT").toUpperCase();
  return Object.values(MediaKind).includes(raw as MediaKind) ? raw as MediaKind : MediaKind.PRODUCT;
}

export async function POST(request: NextRequest) {
  const session = await requireSession();
  await enforceRateLimit({
    key: `upload:${session.id}`,
    limit: 40,
    windowSeconds: 60 * 60,
  });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required." }, { status: 400 });
  }

  try {
    const asset = await createOptimizedMediaAsset({
      file,
      shopId: session.shopId,
      uploadedById: session.id,
      kind: parseKind(formData.get("kind")),
    });
    return NextResponse.json({ asset });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 400 });
  }
}
