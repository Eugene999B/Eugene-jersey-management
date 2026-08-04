import { NextRequest, NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { claimMachineProductionJob } from "@/lib/machine-production-jobs";
import { permissions } from "@/lib/rbac";
import { isTrustedApplicationOrigin } from "@/lib/request-origin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const session = await requireRole(permissions.designs);
  if (!session.shopId) return NextResponse.json({ error: "A shop workspace is required." }, { status: 403 });
  if (!isTrustedApplicationOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const { jobId } = await params;

  try {
    const job = await claimMachineProductionJob({ shopId: session.shopId, jobId, actorId: session.id });
    await audit({
      shopId: session.shopId,
      userId: session.id,
      action: "design.machine-job.claimed",
      entityType: "MachineProductionJob",
      entityId: job.id,
      metadata: {
        attemptNumber: job.attemptCount,
        machineProfileId: job.machineProfileId,
        byteLength: job.byteLength,
      },
    });
    return NextResponse.json({ job });
  } catch (error) {
    if (error instanceof Error && error.message === "MACHINE_JOB_NOT_FOUND") {
      return NextResponse.json({ error: "Cutter job not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message.startsWith("MACHINE_JOB_NOT_SENDABLE:")) {
      const status = error.message.split(":")[1];
      return NextResponse.json({ error: `This cutter job cannot be claimed while its status is ${status}. Refresh the queue before sending.` }, { status: 409 });
    }
    throw error;
  }
}
