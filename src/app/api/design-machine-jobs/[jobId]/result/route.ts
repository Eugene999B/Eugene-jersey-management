import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { finishMachineProductionJob } from "@/lib/machine-production-jobs";
import { permissions } from "@/lib/rbac";
import { isTrustedApplicationOrigin } from "@/lib/request-origin";

const deviceInfoValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const resultSchema = z.object({
  success: z.boolean(),
  deviceInfo: z.record(z.string(), deviceInfoValueSchema).default({}),
  error: z.string().trim().max(1_000).nullable().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const session = await requireRole(permissions.designs);
  if (!session.shopId) return NextResponse.json({ error: "A shop workspace is required." }, { status: 403 });
  if (!isTrustedApplicationOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const parsed = resultSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "The cutter result is invalid." }, { status: 400 });
  const { jobId } = await params;

  try {
    const job = await finishMachineProductionJob({
      shopId: session.shopId,
      jobId,
      actorId: session.id,
      success: parsed.data.success,
      deviceInfo: parsed.data.deviceInfo,
      error: parsed.data.error,
    });
    await audit({
      shopId: session.shopId,
      userId: session.id,
      action: parsed.data.success ? "design.machine-job.sent" : "design.machine-job.failed",
      entityType: "MachineProductionJob",
      entityId: job.id,
      metadata: {
        attemptNumber: job.attemptCount,
        payloadHash: job.payloadHash,
        byteLength: job.byteLength,
        deviceInfo: parsed.data.deviceInfo,
        error: parsed.data.success ? null : job.lastError,
      },
    });
    return NextResponse.json({ job });
  } catch (error) {
    if (error instanceof Error && error.message === "MACHINE_JOB_NOT_SENDING") {
      return NextResponse.json({ error: "This cutter job is no longer in the sending state. Refresh the queue before recording a result." }, { status: 409 });
    }
    throw error;
  }
}
