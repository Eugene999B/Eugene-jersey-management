import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { permissions } from "@/lib/rbac";

export async function GET(_request: Request, context: { params: Promise<{ evidenceId: string }> }) {
  const session = await requireRole(permissions.designs);
  if (!session.shopId) return NextResponse.json({ error: "A shop workspace is required." }, { status: 403 });
  const { evidenceId } = await context.params;
  const evidence = await prisma.heatPressEvidence.findFirst({
    where: { id: evidenceId, shopId: session.shopId },
    select: { id: true, mimeType: true, byteLength: true, data: true },
  });
  if (!evidence) return NextResponse.json({ error: "Evidence photo not found in this shop." }, { status: 404 });

  return new NextResponse(new Uint8Array(evidence.data), {
    status: 200,
    headers: {
      "Content-Type": evidence.mimeType,
      "Content-Length": String(evidence.byteLength),
      "Content-Disposition": `inline; filename="heat-press-${evidence.id}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
