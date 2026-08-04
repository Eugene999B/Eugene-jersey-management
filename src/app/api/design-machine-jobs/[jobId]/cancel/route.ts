import { NextRequest, NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { cancelMachineProductionJob } from "@/lib/machine-production-jobs";
import { permissions } from "@/lib/rbac";
import { isTrustedApplicationOrigin } from "@/lib/request-origin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const session = await requireRole(permissions.designs);
  if (!session.shopId) return NextResponse.json({ error: "A shop workspace is required." }, { status: 403 });
  if (!isTrustedApplicationOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const { jobId } = await params;

  try {
    await cancelMachineProductionJob({ shopId: session.shopId, jobId, actorId: session.id });
    await audit({
      shopId: session.shopId,
      userId: session.id,
      action: "design.machine-job.cancelled",
      entityType: "MachineProductionJob",
      entityId: jobId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "MACHINE_JOB_NOT_CANCELLABLE") {
      return NextResponse.json({ error: "Only prepared or failed cutter jobs can be cancelled. A job already written to the machine cannot be recalled by the browser." }, { status: 409 });
    }
    throw error;
  }
}
