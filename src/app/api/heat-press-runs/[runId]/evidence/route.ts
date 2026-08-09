import { createHash } from "node:crypto";
import { HeatPressEventType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  heatPressPhotoBytesMatchMime,
  heatPressPhotoMimeAllowed,
  MAX_HEAT_PRESS_EVIDENCE_BYTES,
} from "@/lib/heat-press-workflow";
import { permissions } from "@/lib/rbac";
import { isTrustedApplicationOrigin } from "@/lib/request-origin";

export async function POST(request: NextRequest, context: { params: Promise<{ runId: string }> }) {
  const session = await requireRole(permissions.designs);
  if (!session.shopId) return NextResponse.json({ error: "A shop workspace is required." }, { status: 403 });
  if (!isTrustedApplicationOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const shopId = session.shopId;
  const { runId } = await context.params;

  const run = await prisma.heatPressRun.findFirst({ where: { id: runId, shopId }, select: { id: true, attemptNumber: true } });
  if (!run) return NextResponse.json({ error: "Heat press run not found in this shop." }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const photo = form?.get("photo");
  if (!(photo instanceof File)) return NextResponse.json({ error: "Choose a finished-product JPEG, PNG or WebP photo." }, { status: 400 });
  if (!heatPressPhotoMimeAllowed(photo.type)) return NextResponse.json({ error: "Finished-product evidence must be JPEG, PNG or WebP." }, { status: 400 });
  if (photo.size <= 0 || photo.size > MAX_HEAT_PRESS_EVIDENCE_BYTES) {
    return NextResponse.json({ error: "Finished-product evidence must be larger than 0 bytes and no more than 5 MB." }, { status: 400 });
  }

  const bytes = new Uint8Array(await photo.arrayBuffer());
  if (!heatPressPhotoBytesMatchMime(bytes, photo.type)) {
    return NextResponse.json({ error: "The uploaded file contents do not match the declared image type." }, { status: 400 });
  }

  const existingCount = await prisma.heatPressEvidence.count({ where: { shopId, heatPressRunId: run.id } });
  if (existingCount >= 6) return NextResponse.json({ error: "This heat press attempt already has the maximum of 6 evidence photos." }, { status: 400 });

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const evidence = await prisma.$transaction(async (tx) => {
    const created = await tx.heatPressEvidence.create({
      data: {
        shopId,
        heatPressRunId: run.id,
        mimeType: photo.type.toLowerCase(),
        byteLength: bytes.byteLength,
        sha256,
        data: bytes,
        uploadedById: session.id,
      },
      select: { id: true, mimeType: true, byteLength: true, sha256: true, createdAt: true },
    });
    await tx.heatPressEvent.create({
      data: {
        shopId,
        heatPressRunId: run.id,
        type: HeatPressEventType.PHOTO_ATTACHED,
        note: `Finished-product photo ${created.id} attached.`,
        metadata: { mimeType: created.mimeType, byteLength: created.byteLength, sha256: created.sha256 },
        createdById: session.id,
      },
    });
    return created;
  });

  await audit({
    shopId,
    userId: session.id,
    action: "production.heat-press.photo-attached",
    entityType: "HeatPressEvidence",
    entityId: evidence.id,
    metadata: { heatPressRunId: run.id, attemptNumber: run.attemptNumber, mimeType: evidence.mimeType, byteLength: evidence.byteLength, sha256: evidence.sha256 },
  });

  return NextResponse.json({
    evidence: {
      ...evidence,
      createdAt: evidence.createdAt.toISOString(),
      url: `/api/heat-press-evidence/${encodeURIComponent(evidence.id)}`,
    },
  });
}
