import { DesignProductionBriefStatus, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { businessModuleAccessForShop } from "@/lib/business-module-access";
import { prisma } from "@/lib/db";
import { reviewDesignProduction } from "@/lib/design-production-brief";
import { productionSetupRecord, readProductionLibrary } from "@/lib/production-specs";
import { permissions } from "@/lib/rbac";
import { isTrustedApplicationOrigin } from "@/lib/request-origin";

const inputSchema = z.object({
  designJobId: z.string().min(1).max(100),
  garmentId: z.string().min(1).max(100),
  garmentSize: z.string().trim().min(1).max(50),
  placementId: z.string().min(1).max(100),
  materialId: z.string().min(1).max(100),
  action: z.enum(["SAVE", "REVIEW"]),
});

function serializeBrief(brief: {
  id: string;
  designJobId: string;
  garmentId: string;
  garmentSize: string;
  placementId: string;
  materialId: string;
  status: DesignProductionBriefStatus;
  reviewedAt: Date | null;
  updatedAt: Date;
}) {
  return {
    ...brief,
    reviewedAt: brief.reviewedAt?.toISOString() ?? null,
    updatedAt: brief.updatedAt.toISOString(),
  };
}

export async function POST(request: NextRequest) {
  const session = await requireRole(permissions.designs);
  if (!session.shopId) return NextResponse.json({ error: "A shop workspace is required." }, { status: 403 });
  const shopId = session.shopId;

  const moduleAccess = await businessModuleAccessForShop(shopId, "PRINTING_PRODUCTION");
  if (!moduleAccess.operational || !moduleAccess.enabled || !moduleAccess.featureIncluded) {
    return NextResponse.json({ error: "Printing and production is not available for this business." }, { status: 403 });
  }
  if (!isTrustedApplicationOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a saved design, garment, exact size, placement and material." }, { status: 400 });

  const [shop, design] = await Promise.all([
    prisma.shop.findFirst({ where: { id: shopId }, select: { productionSetup: true } }),
    prisma.designJob.findFirst({ where: { id: parsed.data.designJobId, shopId }, select: { id: true, title: true, canvasJson: true } }),
  ]);
  if (!shop || !design) return NextResponse.json({ error: "The saved design is unavailable in this shop." }, { status: 404 });

  const library = readProductionLibrary(shop.productionSetup);
  const garment = library.garments.find((item) => item.id === parsed.data.garmentId && item.isActive);
  const placement = library.placements.find((item) => item.id === parsed.data.placementId && item.isActive);
  const material = library.materials.find((item) => item.id === parsed.data.materialId && item.isActive);
  if (!garment || !placement || !material) {
    return NextResponse.json({ error: "One of the selected production rules is archived or no longer belongs to this shop." }, { status: 400 });
  }

  const canvas = productionSetupRecord(design.canvasJson);
  const review = reviewDesignProduction({ canvas, garment, garmentSize: parsed.data.garmentSize, placement, material });
  if (parsed.data.action === "REVIEW" && review.errors.length) {
    return NextResponse.json({ error: review.errors.join(" "), review }, { status: 400 });
  }

  const reviewed = parsed.data.action === "REVIEW";
  const data = {
    garmentId: garment.id,
    garmentSize: parsed.data.garmentSize,
    placementId: placement.id,
    materialId: material.id,
    garmentSnapshot: garment as unknown as Prisma.InputJsonValue,
    placementSnapshot: placement as unknown as Prisma.InputJsonValue,
    materialSnapshot: material as unknown as Prisma.InputJsonValue,
    cutSheetWidthMm: review.measurements.cutSheetWidthMm,
    cutSheetHeightMm: review.measurements.cutSheetHeightMm,
    artworkWidthMm: review.measurements.artworkWidthMm,
    artworkHeightMm: review.measurements.artworkHeightMm,
    placementWidthMm: review.measurements.placementWidthMm,
    placementHeightMm: review.measurements.placementHeightMm,
    materialWidthMm: review.measurements.materialWidthMm,
    mirror: review.measurements.mirror,
    status: reviewed ? DesignProductionBriefStatus.REVIEWED : DesignProductionBriefStatus.DRAFT,
    reviewedAt: reviewed ? new Date() : null,
    reviewedById: reviewed ? session.id : null,
  };

  const brief = await prisma.designProductionBrief.upsert({
    where: { shopId_designJobId: { shopId, designJobId: design.id } },
    create: { ...data, shopId, designJobId: design.id, createdById: session.id },
    update: data,
    select: {
      id: true,
      designJobId: true,
      garmentId: true,
      garmentSize: true,
      placementId: true,
      materialId: true,
      status: true,
      reviewedAt: true,
      updatedAt: true,
    },
  });

  await audit({
    shopId,
    userId: session.id,
    action: reviewed ? "design.production.reviewed" : "design.production.draft-saved",
    entityType: "DesignProductionBrief",
    entityId: brief.id,
    metadata: {
      designJobId: design.id,
      designTitle: design.title,
      garment: garment.name,
      garmentSize: parsed.data.garmentSize,
      placement: placement.name,
      material: material.name,
      mirror: material.mirrorRequired,
      warnings: review.warnings,
    },
  });

  return NextResponse.json({ brief: serializeBrief(brief), review });
}
