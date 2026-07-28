import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { ensurePlatformGovernanceSettings, serializePlatformGovernance } from "@/lib/platform-governance";
import { governanceChanges, PLATFORM_GOVERNANCE_ID } from "@/lib/platform-governance-shared";
import { requirePlatformPermission } from "@/lib/platform-admin";
import { isTrustedApplicationOrigin } from "@/lib/request-origin";

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null);

const settingsSchema = z.object({
  platformName: z.string().trim().min(2).max(100),
  legalCompanyName: optionalText(140),
  supportEmail: z.union([z.literal(""), z.string().trim().email().max(160)]).transform((value) => value || null),
  supportPhone: optionalText(40),
  defaultCountry: z.string().trim().min(2).max(80),
  defaultCurrency: z.string().trim().min(3).max(3).transform((value) => value.toUpperCase()),
  defaultTimezone: z.string().trim().min(3).max(80),
  termsVersion: optionalText(40),
  privacyVersion: optionalText(40),
  marketplaceEnabled: z.boolean(),
  publicApplicationsEnabled: z.boolean(),
  maintenanceMode: z.boolean(),
  incidentMode: z.boolean(),
  paymentsEnabled: z.boolean(),
  messagingEnabled: z.boolean(),
  signupsEnabled: z.boolean(),
  maintenanceNotice: optionalText(500),
  trialDays: z.number().int().min(0).max(365),
  includedStaffAccounts: z.number().int().min(1).max(10_000),
  supportSlaHours: z.number().int().min(1).max(720),
  loginAttemptLimit: z.number().int().min(3).max(20),
  sessionLifetimeMinutes: z.number().int().min(15).max(525_600),
  sensitiveActionReauthMinutes: z.number().int().min(1).max(1_440),
  auditRetentionDays: z.number().int().min(30).max(36_500),
  dataRetentionDays: z.number().int().min(30).max(36_500),
  allowedUploadTypes: z.array(z.string().trim().min(3).max(100)).min(1).max(20),
  reason: z.string().trim().min(5).max(300),
});

function requestContext(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: forwarded || request.headers.get("x-real-ip") || "unknown",
    userAgent: (request.headers.get("user-agent") ?? "unknown").slice(0, 300),
  };
}

export async function GET() {
  await requirePlatformPermission("settings");
  return NextResponse.json({ settings: await ensurePlatformGovernanceSettings() });
}

export async function PATCH(request: NextRequest) {
  const session = await requirePlatformPermission("settings");
  if (!isTrustedApplicationOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the governance values and provide a clear change reason." },
      { status: 400 },
    );
  }

  const previous = await ensurePlatformGovernanceSettings();
  const { reason, ...input } = parsed.data;
  const updated = await prisma.platformGovernanceSettings.upsert({
    where: { id: PLATFORM_GOVERNANCE_ID },
    create: { id: PLATFORM_GOVERNANCE_ID, ...input, updatedById: session.id },
    update: { ...input, updatedById: session.id },
  });
  const next = serializePlatformGovernance(updated);
  const changes = governanceChanges(previous, next);

  if (Object.keys(changes).length > 0) {
    await audit({
      userId: session.id,
      action: "platform.governance.updated",
      entityType: "PlatformGovernanceSettings",
      entityId: PLATFORM_GOVERNANCE_ID,
      metadata: { reason, changes, ...requestContext(request) },
    });
  }

  return NextResponse.json({ settings: next, changedFields: Object.keys(changes) });
}
