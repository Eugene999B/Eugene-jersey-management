import { DesignJobStatus, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { ensureShopMachineProfiles, serializeMachineProfile } from "@/lib/design-machine-profile-server";
import { prisma } from "@/lib/db";
import { nextDesignVersionNumber } from "@/lib/design-history";
import { permissions } from "@/lib/rbac";
import { isTrustedApplicationOrigin } from "@/lib/request-origin";

const designSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().trim().min(2).max(120),
  customer: z.string().trim().max(120).optional(),
  machineProfile: z.string().trim().min(2).max(80).optional(),
  canvas: z.record(z.string(), z.unknown()),
});

function retryableVersionConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError
    && (error.code === "P2034" || error.code === "P2002");
}

export async function POST(request: NextRequest) {
  const session = await requireRole(permissions.designs);
  if (!session.shopId) return NextResponse.json({ error: "A shop workspace is required." }, { status: 403 });
  const shopId = session.shopId;

  if (!isTrustedApplicationOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const parsed = designSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the design name and project data." }, { status: 400 });

  const availableProfiles = await ensureShopMachineProfiles(shopId);
  const requestedProfileId = typeof parsed.data.canvas.machineProfileId === "string"
    ? parsed.data.canvas.machineProfileId
    : null;
  const selectedSummary = requestedProfileId
    ? availableProfiles.find((profile) => profile.id === requestedProfileId && profile.isActive)
    : availableProfiles.find((profile) => profile.isDefault && profile.isActive) ?? availableProfiles.find((profile) => profile.isActive);
  if (!selectedSummary) {
    return NextResponse.json({ error: "Choose an active machine profile belonging to this shop." }, { status: 400 });
  }
  const selectedRecord = await prisma.shopMachineProfile.findFirst({
    where: { id: selectedSummary.id, shopId, isActive: true },
  });
  if (!selectedRecord) {
    return NextResponse.json({ error: "The selected machine profile is unavailable in this shop." }, { status: 400 });
  }
  const machineSnapshot = serializeMachineProfile(selectedRecord);
  const canvas = {
    ...parsed.data.canvas,
    machineProfileId: selectedRecord.id,
    machineProfile: selectedRecord.name,
    machineSettings: machineSnapshot,
  };

  const serialized = JSON.stringify(canvas);
  if (serialized.length > 2_000_000) {
    return NextResponse.json({ error: "This project is too large to save. Upload raster artwork instead of embedding it." }, { status: 413 });
  }

  let customerId: string | null = null;
  if (parsed.data.customer) {
    const matches = await prisma.customer.findMany({
      where: { shopId, name: { equals: parsed.data.customer, mode: "insensitive" } },
      select: { id: true },
      take: 2,
    });
    if (matches.length === 1) customerId = matches[0].id;
  }

  const data = {
    title: parsed.data.title,
    customerId,
    machineProfile: selectedRecord.name,
    exportFormat: selectedRecord.outputFormat,
    canvasJson: canvas as Prisma.InputJsonValue,
    status: DesignJobStatus.DRAFT,
  };

  let saved: { design: { id: string; title: string; machineProfile: string | null; canvasJson: Prisma.JsonValue; updatedAt: Date }; versionNumber: number } | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      saved = await prisma.$transaction(async (transaction) => {
        if (parsed.data.id) {
          const existing = await transaction.designJob.findFirst({
            where: { id: parsed.data.id, shopId },
            select: { id: true, title: true, canvasJson: true, machineProfile: true },
          });
          if (!existing) return null;

          const maximum = await transaction.designJobVersion.aggregate({
            where: { shopId, designJobId: existing.id },
            _max: { versionNumber: true },
          });
          let currentMaximum = maximum._max?.versionNumber ?? null;

          if (!currentMaximum) {
            await transaction.designJobVersion.create({
              data: {
                shopId,
                designJobId: existing.id,
                versionNumber: 1,
                title: existing.title,
                canvasJson: existing.canvasJson as Prisma.InputJsonValue,
                machineProfile: existing.machineProfile,
                source: "BASELINE",
                createdById: session.id,
              },
            });
            currentMaximum = 1;
          }

          const design = await transaction.designJob.update({ where: { id: existing.id }, data });
          const versionNumber = nextDesignVersionNumber(currentMaximum);
          await transaction.designJobVersion.create({
            data: {
              shopId,
              designJobId: design.id,
              versionNumber,
              title: design.title,
              canvasJson: design.canvasJson as Prisma.InputJsonValue,
              machineProfile: design.machineProfile,
              source: "SAVE",
              createdById: session.id,
            },
          });
          return { design, versionNumber };
        }

        const design = await transaction.designJob.create({ data: { ...data, shopId } });
        const versionNumber = 1;
        await transaction.designJobVersion.create({
          data: {
            shopId,
            designJobId: design.id,
            versionNumber,
            title: design.title,
            canvasJson: design.canvasJson as Prisma.InputJsonValue,
            machineProfile: design.machineProfile,
            source: "CREATE",
            createdById: session.id,
          },
        });
        return { design, versionNumber };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      break;
    } catch (error) {
      if (attempt === 0 && retryableVersionConflict(error)) continue;
      if (retryableVersionConflict(error)) {
        return NextResponse.json({ error: "This project changed in another session. Reload it and save again." }, { status: 409 });
      }
      throw error;
    }
  }

  if (!saved) return NextResponse.json({ error: "Design project not found." }, { status: 404 });

  await audit({
    shopId,
    userId: session.id,
    action: parsed.data.id ? "design.updated" : "design.created",
    entityType: "DesignJob",
    entityId: saved.design.id,
    metadata: {
      title: saved.design.title,
      machineProfile: saved.design.machineProfile,
      machineProfileId: selectedRecord.id,
      outputFormat: selectedRecord.outputFormat,
      versionNumber: saved.versionNumber,
    },
  });

  return NextResponse.json({
    design: {
      id: saved.design.id,
      title: saved.design.title,
      updatedAt: saved.design.updatedAt.toISOString(),
      versionNumber: saved.versionNumber,
      machineProfile: machineSnapshot,
    },
  });
}
