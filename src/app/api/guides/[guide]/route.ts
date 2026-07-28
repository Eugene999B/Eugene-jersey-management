import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAllowedPlatformPermissions, requirePlatformPermission } from "@/lib/platform-admin";
import { hasRole, permissions } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { adminHandbook, adminPageGuide, buildGuideDocx, designGuide, type OperatorGuide } from "@/lib/operator-guides";

export const dynamic = "force-dynamic";

function filename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "");
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ guide: string }> }) {
  const { guide } = await params;
  let content: OperatorGuide;
  let outputName: string;

  if (guide === "design-studio") {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (session.role === Role.SUPER_ADMIN) {
      const allowedPermissions = await getAllowedPlatformPermissions(session.id);
      if (allowedPermissions !== null) return NextResponse.json({ error: "This guide is restricted to shop design workers or the main administrator." }, { status: 403 });
    } else if (!hasRole(session, permissions.designs)) {
      return NextResponse.json({ error: "Design Studio access is required." }, { status: 403 });
    }
    content = designGuide();
    outputName = "EJM-Design-Studio-Quick-Guide.docx";
  } else if (guide === "admin-handbook" || guide === "admin-page") {
    const session = await requirePlatformPermission();
    const allowedPermissions = await getAllowedPlatformPermissions(session.id);
    if (allowedPermissions !== null) return NextResponse.json({ error: "This guide is restricted to the main administrator." }, { status: 403 });
    if (guide === "admin-handbook") {
      content = adminHandbook;
      outputName = "EJM-Complete-Administrator-Handbook.docx";
    } else {
      const pathname = request.nextUrl.searchParams.get("page") || "/admin";
      content = adminPageGuide(pathname);
      outputName = `${filename(content.title)}.docx`;
    }
  } else {
    return NextResponse.json({ error: "Guide not found." }, { status: 404 });
  }

  const buffer = await buildGuideDocx(content);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${outputName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
