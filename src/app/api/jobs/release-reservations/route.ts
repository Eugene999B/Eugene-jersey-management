import { NextRequest, NextResponse } from "next/server";
import { releaseExpiredReservations } from "@/lib/reservations";

export async function POST(request: NextRequest) {
  const secret = process.env.JOB_SECRET;
  if (!secret) return NextResponse.json({ error: "Background job authentication is not configured." }, { status: 503 });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (token !== secret) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const result = await releaseExpiredReservations();
  return NextResponse.json(result);
}
