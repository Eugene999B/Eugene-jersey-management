import { HeatPressEventType, HeatPressRunStatus, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { businessModuleAccessForShop } from "@/lib/business-module-access";
import { prisma } from "@/lib/db";
import { heatPressRecipeFromBrief } from "@/lib/heat-press-workflow";
import { permissions } from "@/lib/rbac";
import { isTrustedApplicationOrigin } from "@/lib/request-origin";

const inputSchema = z.object({
  designProductionBriefId: z.string().min(1).max(120),
});

function writableSnapshot(value: Prisma.JsonValue, label: string): Prisma.InputJsonValue {
  if (value === null) throw new Error(`${label} snapshot is unavailable.`);
  return value as Prisma.InputJsonValue;
}

function serializeRun(run: {
  id: string;
  designProductionBriefId: string;
  attemptNumber: number;
  status: HeatPressRunStatus;
  timerMode: "FIRST_PRESS" | "REPRESS" | null;
  timerStartedAt: Date | null;
  timerElapsedMs: number;
  firstPressElapsedMs: number | null;
  repressElapsedMs: number | null;
  firstPressCompletedAt: Date | null;
  peelCompletedAt: Date | null;
  repressCompletedAt: Date | null;
  qualityPassedAt: Date | null;
  reworkReason: string | null;
  pressTemperatureC: number;
  pressDurationSeconds: number;
  pressure: string;
  peelType: string;
  repressSeconds: number;
  materialSnapshot: Prisma.JsonValue;
  garmentSnapshot: Prisma.JsonValue;
  placementSnapshot: Prisma.JsonValue;
  updatedAt: Date;
}) {
  return {
    ...run,
    timerStartedAt: run.timerStartedAt?.toISOString() ?? null,
    firstPressCompletedAt: run.firstPressCompletedAt?.toISOString() ?? null,
    peelCompletedAt: run.peelCompletedAt?.toISOString() ?? null,
    repressCompletedAt: run.repressCompletedAt?.toISOString() ?? null,
    qualityPassedAt: run.qualityPassedAt?.toISOString() ?? null,
    updatedAt: run.updatedAt.toISOString(),
  };
}

export async function POST(request: NextRequest) {
  const session = await requireRole(permissions.designs);
  if (!session.shopId) return NextResponse.json({ error: "A shop workspace is required." }, { status: 403 });
  const shopId = session.shopId;
  if (!isTrustedApplicationOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });

  const moduleAccess = await businessModuleAccessForShop(shopId, "PRINTING_PRODUCTION");
  if (!moduleAccess.operational || !moduleAccess.enabled || !moduleAccess.featureIncluded) {
    return NextResponse.json({ error: "Printing and production is not available for this business." }, { status: 403 });
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a reviewed production brief." }, { status: 400 });

  const brief = await prisma.designProductionBrief.findFirst({
    where: { id: parsed.data.designProductionBriefId, shopId, status: "REVIEWED" },
    select: {
      id: true,
      garmentSize: true,
      materialSnapshot: true,
      garmentSnapshot: true,
      placementSnapshot: true,
    },
  });
  if (!brief) return NextResponse.json({ error: "The reviewed production brief is unavailable in this shop." }, { status: 404 });

  const recipe = heatPressRecipeFromBrief(brief);
  const materialSnapshot = writableSnapshot(brief.materialSnapshot, "Material");
  const garmentSnapshot = writableSnapshot(brief.garmentSnapshot, "Garment");
  const placementSnapshot = writableSnapshot(brief.placementSnapshot, "Placement");
  const run = await prisma.$transaction(async (tx) => {
    const latest = await tx.heatPressRun.findFirst({
      where: { shopId, designProductionBriefId: brief.id },
      orderBy: { attemptNumber: "desc" },
    });
    if (latest && latest.status !== HeatPressRunStatus.REWORK_REQUIRED) return latest;

    const created = await tx.heatPressRun.create({
      data: {
        shopId,
        designProductionBriefId: brief.id,
        attemptNumber: (latest?.attemptNumber ?? 0) + 1,
        status: HeatPressRunStatus.READY,
        materialSnapshot,
        garmentSnapshot,
        placementSnapshot,
        pressTemperatureC: recipe.pressTemperatureC,
        pressDurationSeconds: recipe.pressDurationSeconds,
        pressure: recipe.pressure,
        peelType: recipe.peelType,
        repressSeconds: recipe.repressSeconds,
        createdById: session.id,
        updatedById: session.id,
      },
    });
    await tx.heatPressEvent.create({
      data: {
        shopId,
        heatPressRunId: created.id,
        type: HeatPressEventType.RUN_CREATED,
        note: latest ? `Rework attempt ${created.attemptNumber} created.` : "Heat press execution created from reviewed production brief.",
        createdById: session.id,
      },
    });
    return created;
  });

  await audit({
    shopId,
    userId: session.id,
    action: "production.heat-press.run-created",
    entityType: "HeatPressRun",
    entityId: run.id,
    metadata: { designProductionBriefId: brief.id, attemptNumber: run.attemptNumber, material: recipe.materialName, garment: recipe.garmentName },
  });

  return NextResponse.json({ run: serializeRun(run), recipe });
}
