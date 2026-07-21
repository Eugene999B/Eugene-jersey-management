import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const smsProvider = (process.env.SMS_PROVIDER ?? "console").toLowerCase();
    return NextResponse.json({
      status: "ready",
      database: "connected",
      services: {
        paymentsConfigured: Boolean(process.env.PAYSTACK_SECRET_KEY),
        smsProvider,
        smsConfigured: smsProvider === "arkesel"
          ? Boolean(process.env.ARKESEL_API_KEY && process.env.ARKESEL_SENDER_ID)
          : Boolean(process.env.SMS_API_URL && process.env.SMS_API_TOKEN),
        mediaStorage: (process.env.MEDIA_STORAGE_PROVIDER ?? "local").toLowerCase(),
      },
      responseTimeMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({
      status: "unavailable",
      database: "disconnected",
      responseTimeMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
