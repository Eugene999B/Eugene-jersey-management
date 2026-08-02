import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { businessModuleAccessForShop } from "@/lib/business-module-access";
import { prisma } from "@/lib/db";
import {
  DESIGN_VERSION_HISTORY_LIMIT,
  designVersionSourceLabel,
  safeDesignVersionNumber,
} from "@/lib/design-history";
import { permissions } from "@/lib/rbac";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireRole(permissions.designs);
  if (!session.shopId) return NextResponse.json({ error: "A shop workspace is required." }, { status: 403 });
  const moduleAccess = await businessModuleAccessForShop(session.shopId, "PRINTING_PRODUCTION");
  if (!moduleAccess.operational || !moduleAccess.enabled || !moduleAccess.featureIncluded) {
    return NextResponse.json({ error: "Printing and production is not available for this business." }, { status: 403 });
  }

  const { id } = await context.params;
  const design = await prisma.designJob.findFirst({
    where: { id, shopId: session.shopId },
    select: { id: true },
  });
  if (!design) return NextResponse.json({ error: "Design project not found." }, { status: 404 });

  const requestedValue = request.nextUrl.searchParams.get("version");
  if (requestedValue !== null) {
    const versionNumber = safeDesignVersionNumber(requestedValue);
    if (!versionNumber) return NextResponse.json({ error: "Choose a valid design version." }, { status: 400 });

    const version = await prisma.designJobVersion.findFirst({
      where: { shopId: session.shopId, designJobId: design.id, versionNumber },
      select: {
        id: true,
        versionNumber: true,
        title: true,
        canvasJson: true,
        machineProfile: true,
        source: true,
        createdById: true,
        createdAt: true,
      },
    });
    if (!version) return NextResponse.json({ error: "Design version not found." }, { status: 404 });

    const creator = version.createdById
      ? await prisma.user.findFirst({
          where: { id: version.createdById, shopId: session.shopId },
          select: { name: true },
        })
      : null;

    return NextResponse.json({
      version: {
        id: version.id,
        versionNumber: version.versionNumber,
        title: version.title,
        canvas: version.canvasJson,
        machineProfile: version.machineProfile,
        source: version.source,
        sourceLabel: designVersionSourceLabel(version.source),
        createdByName: creator?.name ?? "System",
        createdAt: version.createdAt.toISOString(),
      },
    });
  }

  const versions = await prisma.designJobVersion.findMany({
    where: { shopId: session.shopId, designJobId: design.id },
    select: {
      id: true,
      versionNumber: true,
      title: true,
      machineProfile: true,
      source: true,
      createdById: true,
      createdAt: true,
    },
    orderBy: { versionNumber: "desc" },
    take: DESIGN_VERSION_HISTORY_LIMIT,
  });

  const creatorIds = Array.from(new Set(versions.map((version) => version.createdById).filter((value): value is string => Boolean(value))));
  const creators = creatorIds.length
    ? await prisma.user.findMany({
        where: { shopId: session.shopId, id: { in: creatorIds } },
        select: { id: true, name: true },
      })
    : [];
  const creatorNames = new Map(creators.map((creator) => [creator.id, creator.name]));

  return NextResponse.json({
    versions: versions.map((version) => ({
      id: version.id,
      versionNumber: version.versionNumber,
      title: version.title,
      machineProfile: version.machineProfile,
      source: version.source,
      sourceLabel: designVersionSourceLabel(version.source),
      createdByName: version.createdById ? creatorNames.get(version.createdById) ?? "Former staff member" : "System",
      createdAt: version.createdAt.toISOString(),
    })),
  });
}
