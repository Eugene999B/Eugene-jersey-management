import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";

export async function GET(request: NextRequest) {
  await requireRole(permissions.reports);
  const daysValue = Number(request.nextUrl.searchParams.get("range") ?? "30");
  const days = [0, 7, 30, 365].includes(daysValue) ? daysValue : 30;
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - days);

  const target = new URL("/api/exports", request.url);
  target.searchParams.set("module", "pos");
  target.searchParams.set("format", request.nextUrl.searchParams.get("format") ?? "csv");
  target.searchParams.set("from", from.toISOString().slice(0, 10));
  target.searchParams.set("to", new Date().toISOString().slice(0, 10));
  return NextResponse.redirect(target, 307);
}
