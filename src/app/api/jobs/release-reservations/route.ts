import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { releaseExpiredReservations } from "@/lib/reservations";
import { RESERVATION_RELEASE_JOB_KEY, runMonitoredJob } from "@/lib/scheduled-jobs";

export const dynamic = "force-dynamic";

function configuredToken() {
  const token = (process.env.JOBS_API_TOKEN ?? process.env.JOB_SECRET)?.trim();
  return token && token.length >= 32 ? token : null;
}

function suppliedToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

function tokenMatches(left: string, right: string) {
  const leftHash = createHash("sha256").update(left, "utf8").digest();
  const rightHash = createHash("sha256").update(right, "utf8").digest();
  return timingSafeEqual(leftHash, rightHash);
}

export async function POST(request: NextRequest) {
  const expected = configuredToken();
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "Scheduled jobs are not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const supplied = suppliedToken(request);
  if (!supplied || !tokenMatches(supplied, expected)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401, headers: { "Cache-Control": "no-store", "WWW-Authenticate": "Bearer" } },
    );
  }

  try {
    const result = await runMonitoredJob(RESERVATION_RELEASE_JOB_KEY, () => releaseExpiredReservations());
    return NextResponse.json(
      { ok: true, job: RESERVATION_RELEASE_JOB_KEY, result, completedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, job: RESERVATION_RELEASE_JOB_KEY, error: "Scheduled reservation release failed." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
