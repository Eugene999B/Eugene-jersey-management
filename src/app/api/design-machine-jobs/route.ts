import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validateHpglCutterPayload } from "@/lib/design-hpgl-validation";
import {
  createMachineProductionJob,
  listMachineProductionJobs,
} from "@/lib/machine-production-jobs";
import { permissions } from "@/lib/rbac";
import { isTrustedApplicationOrigin } from "@/lib/request-origin";

const checklistSchema = z.object({
  materialLoaded: z.literal(true),
  pinchRollersLocked: z.literal(true),
  bladeChecked: z.literal(true),
  originSet: z.literal(true),
  areaClear: z.literal(true),
  testCutPassed: z.literal(true),
});

const createSchema = z.object({
  designJobId: z.string().min(1).max(100),
  machineProfileId: z.string().min(1).max(100),
  jobName: z.string().trim().min(2).max(120),
  material: z.string().trim().min(2).max(80),
  materialWidthMm: z.number().finite().min(20).max(2_000),
  sheetWidthMm: z.number().finite().min(20).max(2_000),
  sheetHeightMm: z.number().finite().min(20).max(5_000),
  mirror: z.boolean(),
  origin: z.enum(["BOTTOM_LEFT", "TOP_LEFT"]),
  copies: z.literal(1),
  payload: z.string().min(10).max(2_000_000),
  pathCount: z.number().int().min(1).max(100_000),
  checklist: checklistSchema,
  warnings: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
  allowDuplicate: z.boolean().default(false),
});

function jobError(error: unknown) {
  if (!(error instanceof Error)) throw error;
  const duplicate = error.message.match(/MACHINE_JOB_DUPLICATE:([A-Za-z0-9_-]+)/);
  if (duplicate) {
    return NextResponse.json({
      error: "This exact cutter payload is already queued, sending, failed and awaiting review, or already sent to this machine within the last 15 minutes. Review the previous job before choosing an intentional resend.",
      code: "MACHINE_JOB_DUPLICATE",
      existingJobId: duplicate[1],
    }, { status: 409 });
  }
  if (error.message.includes("MACHINE_JOB_SOURCE_INVALID")) {
    return NextResponse.json({ error: "The saved design or active direct HPGL machine profile is no longer available in this shop." }, { status: 400 });
  }
  throw error;
}

export async function GET() {
  const session = await requireRole(permissions.designs);
  if (!session.shopId) return NextResponse.json({ error: "A shop workspace is required." }, { status: 403 });
  const jobs = await listMachineProductionJobs(session.shopId, 60);
  return NextResponse.json({ jobs });
}

export async function POST(request: NextRequest) {
  const session = await requireRole(permissions.designs);
  if (!session.shopId) return NextResponse.json({ error: "A shop workspace is required." }, { status: 403 });
  if (!isTrustedApplicationOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Complete every machine, material, test-cut and safety check before preparing the cutter job." }, { status: 400 });
  }
  if (parsed.data.materialWidthMm + 0.01 < parsed.data.sheetWidthMm) {
    return NextResponse.json({ error: "The loaded material is narrower than the prepared production area." }, { status: 400 });
  }

  const [design, profile] = await Promise.all([
    prisma.designJob.findFirst({
      where: { id: parsed.data.designJobId, shopId: session.shopId },
      select: { id: true, title: true },
    }),
    prisma.shopMachineProfile.findFirst({
      where: {
        id: parsed.data.machineProfileId,
        shopId: session.shopId,
        isActive: true,
        outputFormat: "HPGL",
        connectionMode: "WEB_SERIAL",
      },
      select: { id: true, name: true, bedWidthMm: true, bedHeightMm: true, unitsPerMm: true },
    }),
  ]);
  if (!design) return NextResponse.json({ error: "Choose a saved design belonging to this shop." }, { status: 404 });
  if (!profile) return NextResponse.json({ error: "Choose an active direct-serial HPGL cutter profile belonging to this shop." }, { status: 400 });
  if (parsed.data.sheetWidthMm > profile.bedWidthMm + 0.01 || parsed.data.sheetHeightMm > profile.bedHeightMm + 0.01) {
    return NextResponse.json({ error: "The prepared production area exceeds the selected machine profile." }, { status: 400 });
  }

  const hpgl = validateHpglCutterPayload({
    payload: parsed.data.payload,
    maxX: Math.ceil(parsed.data.sheetWidthMm * profile.unitsPerMm),
    maxY: Math.ceil(parsed.data.sheetHeightMm * profile.unitsPerMm),
  });
  if (!hpgl.valid) {
    return NextResponse.json({ error: hpgl.error ?? "The prepared output is not a valid bounded HPGL cutter payload." }, { status: 400 });
  }

  const payloadHash = createHash("sha256")
    .update(`${profile.id}\n${parsed.data.origin}\n${parsed.data.mirror}\n${hpgl.normalized}`, "utf8")
    .digest("hex");

  try {
    const job = await createMachineProductionJob({
      shopId: session.shopId,
      designJobId: design.id,
      machineProfileId: profile.id,
      createdById: session.id,
      jobName: parsed.data.jobName,
      material: parsed.data.material,
      materialWidthMm: parsed.data.materialWidthMm,
      sheetWidthMm: parsed.data.sheetWidthMm,
      sheetHeightMm: parsed.data.sheetHeightMm,
      mirror: parsed.data.mirror,
      origin: parsed.data.origin,
      payload: hpgl.normalized,
      payloadHash,
      pathCount: parsed.data.pathCount,
      checklist: parsed.data.checklist,
      warnings: parsed.data.warnings,
      allowDuplicate: parsed.data.allowDuplicate,
    });

    await audit({
      shopId: session.shopId,
      userId: session.id,
      action: "design.machine-job.prepared",
      entityType: "MachineProductionJob",
      entityId: job.id,
      metadata: {
        designJobId: design.id,
        designTitle: design.title,
        machineProfileId: profile.id,
        machineName: profile.name,
        payloadHash,
        pathCount: job.pathCount,
        byteLength: job.byteLength,
        material: job.material,
        materialWidthMm: job.materialWidthMm,
      },
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    return jobError(error);
  }
}