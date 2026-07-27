import { NextRequest, NextResponse } from "next/server";
import { DesignJobStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { nextDesignVersionNumber } from "@/lib/design-history";
import { permissions } from "@/lib/rbac";
import { isTrustedApplicationOrigin } from "@/lib/request-origin";

const designSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().trim().min(2).max(120),
  customer: z.string().trim().max(120).optional(),
  machineProfile: z.enum(["Generic SVG", "HPGL / PLT cutter", "SignMaster", "VinylMaster", "Print/RIP"]),
  canvas: z.record(z.string(), z.unknown()),
});

function retryableVersionConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError
    && (error.code === "P2034" || error.code === "P2002");
}

export async function POST(request: NextRequest) {
  const session = await requireRole(permissions.designs);
  if (!session.shopId) return NextResponse.json({ error: "A shop workspace is required." }, { status: 403 });

  if (!isTrustedApplicationOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const parsed = designSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the design name and project data." }, { status: 400 });

  const serialized = JSON.stringify(parsed.data.canvas);
  if (serialized.length > 2_000_000) {
    return NextResponse.json({ error: "This project is too large to save. Upload raster artwork instead of embedding it." }, { status: 413 });
  }

  let customerId: string | null = null;
  if (parsed.data.customer) {
    const matches = await prisma.customer.findMany({
      where: { shopId: session.shopId, name: { equals: parsed.data.customer, mode: "insensitive" } },
      select: { id: true },
      take: 2,
    });
    if (matches.length === 1) customerId = matches[0].id;
  }

  const data = {
    title: parsed.data.title,
    customerId,
    machineProfile: parsed.data.machineProfile,
    exportFormat: parsed.data.machineProfile === "HPGL / PLT cutter" ? "HPGL" : "SVG",
    canvasJson: parsed.data.canvas as Prisma.InputJsonValue,
    status: DesignJobStatus.DRAFT,
  };

  let saved: { design: { id: string; title: string; machineProfile: string | null; canvasJson: Prisma.JsonValue; updatedAt: Date }; versionNumber: number } | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      saved = await prisma.$transaction(async (transaction) => {
        if (parsed.data.id) {
          const existing = await transaction.designJob.findFirst({
            where: { id: parsed.data.id, shopId: session.shopId },
            select: { id: true, title: true, canvasJson: true, machineProfile: true },
          });
          if (!existing) return null;

          const maximum = await transaction.designJobVersion.aggregate({
            where: { shopId: session.shopId, designJobId: existing.id },
            _max: { versionNumber: true },
          });
          let currentMaximum = maximum._max.versionNumber;

          if (!currentMaximum) {
            await transaction.designJobVersion.create({
              data: {
                shopId: session.shopId,
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
              shopId: session.shopId,
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

        const design = await transaction.designJob.create({ data: { ...data, shopId: session.shopId } });
        const versionNumber = 1;
        await transaction.designJobVersion.create({
          data: {
            shopId: session.shopId,
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
    shopId: session.shopId,
    userId: session.id,
    action: parsed.data.id ? "design.updated" : "design.created",
    entityType: "DesignJob",
    entityId: saved.design.id,
    metadata: {
      title: saved.design.title,
      machineProfile: saved.design.machineProfile,
      versionNumber: saved.versionNumber,
    },
  });

  return NextResponse.json({
    design: {
      id: saved.design.id,
      title: saved.design.title,
      updatedAt: saved.design.updatedAt.toISOString(),
      versionNumber: saved.versionNumber,
    },
  });
}
