import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest, context: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await context.params;
  const access = request.nextUrl.searchParams.get("access")?.trim();
  if (!access) return NextResponse.json({ error: "Artwork access token is required." }, { status: 403 });
  const asset = await prisma.customerProductionAsset.findUnique({ where: { id: assetId } });
  if (!asset) return NextResponse.json({ error: "Artwork not found." }, { status: 404 });
  const productionRequest = await prisma.customerProductionRequest.findFirst({
    where: { id: asset.requestId, shopId: asset.shopId, publicAccessToken: access },
    select: { id: true },
  });
  if (!productionRequest) return NextResponse.json({ error: "Artwork access denied." }, { status: 403 });
  return new NextResponse(asset.data, {
    status: 200,
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(asset.byteLength),
      "Content-Disposition": `inline; filename="${asset.originalName.replaceAll('"', "")}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
