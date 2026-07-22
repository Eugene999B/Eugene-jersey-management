import { NextRequest, NextResponse } from "next/server";
import { DesignJobStatus, type Prisma } from "@prisma/client";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { permissions } from "@/lib/rbac";

const designSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().trim().min(2).max(120),
  customer: z.string().trim().max(120).optional(),
  machineProfile: z.enum(["Generic SVG", "SignMaster", "VinylMaster", "Print/RIP"]),
  canvas: z.record(z.string(), z.unknown()),
});

export async function POST(request: NextRequest) {
  const session = await requireRole(permissions.designs);
  if (!session.shopId) return NextResponse.json({ error: "A shop workspace is required." }, { status: 403 });

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
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
    exportFormat: "SVG",
    canvasJson: parsed.data.canvas as Prisma.InputJsonValue,
    status: DesignJobStatus.DRAFT,
  };

  let design;
  if (parsed.data.id) {
    const existing = await prisma.designJob.findFirst({ where: { id: parsed.data.id, shopId: session.shopId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Design project not found." }, { status: 404 });
    design = await prisma.designJob.update({ where: { id: existing.id }, data });
  } else {
    design = await prisma.designJob.create({ data: { ...data, shopId: session.shopId } });
  }

  await audit({
    shopId: session.shopId,
    userId: session.id,
    action: parsed.data.id ? "design.updated" : "design.created",
    entityType: "DesignJob",
    entityId: design.id,
    metadata: { title: design.title, machineProfile: design.machineProfile },
  });

  return NextResponse.json({ design: { id: design.id, title: design.title, updatedAt: design.updatedAt.toISOString() } });
}
