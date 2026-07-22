import { NextRequest, NextResponse } from "next/server";
import { MediaKind } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { createOptimizedMediaAsset } from "@/lib/media-storage";
import { enforceRateLimit } from "@/lib/rate-limit";
import { hasRole, permissions } from "@/lib/rbac";

function parseKind(value: FormDataEntryValue | null) {
  const raw = String(value ?? "PRODUCT").toUpperCase();
  return Object.values(MediaKind).includes(raw as MediaKind) ? raw as MediaKind : MediaKind.PRODUCT;
}

export async function POST(request: NextRequest) {
  const session = await requireSession();
  if (!session.shopId) return NextResponse.json({ error: "A shop workspace is required." }, { status: 403 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  await enforceRateLimit({
    key: `upload:${session.id}`,
    limit: 40,
    windowSeconds: 60 * 60,
  });

  const formData = await request.formData();
  const kind = parseKind(formData.get("kind"));
  const allowed = kind === MediaKind.DESIGN_ASSET
    ? hasRole(session, permissions.designs)
    : kind === MediaKind.PRODUCT
      ? hasRole(session, permissions.catalogWrite)
      : kind === MediaKind.SHOP_LOGO || kind === MediaKind.SHOP_CREDENTIAL
        ? hasRole(session, permissions.settings)
        : false;
  if (!allowed) return NextResponse.json({ error: "You do not have permission to upload this asset type." }, { status: 403 });
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required." }, { status: 400 });
  }

  try {
    const asset = await createOptimizedMediaAsset({
      file,
      shopId: session.shopId,
      uploadedById: session.id,
      kind,
    });
    return NextResponse.json({ asset });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 400 });
  }
}
