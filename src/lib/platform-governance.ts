import type { PlatformGovernanceSettings } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  DEFAULT_PLATFORM_GOVERNANCE,
  PLATFORM_GOVERNANCE_ID,
  type PlatformGovernanceSettingsData,
} from "@/lib/platform-governance-shared";

export function serializePlatformGovernance(
  settings: PlatformGovernanceSettings,
): PlatformGovernanceSettingsData {
  return {
    id: settings.id,
    platformName: settings.platformName,
    legalCompanyName: settings.legalCompanyName ?? "",
    supportEmail: settings.supportEmail ?? "",
    supportPhone: settings.supportPhone ?? "",
    defaultCountry: settings.defaultCountry,
    defaultCurrency: settings.defaultCurrency,
    defaultTimezone: settings.defaultTimezone,
    termsVersion: settings.termsVersion ?? "",
    privacyVersion: settings.privacyVersion ?? "",
    marketplaceEnabled: settings.marketplaceEnabled,
    publicApplicationsEnabled: settings.publicApplicationsEnabled,
    maintenanceMode: settings.maintenanceMode,
    incidentMode: settings.incidentMode,
    paymentsEnabled: settings.paymentsEnabled,
    messagingEnabled: settings.messagingEnabled,
    signupsEnabled: settings.signupsEnabled,
    maintenanceNotice: settings.maintenanceNotice ?? "",
    trialDays: settings.trialDays,
    includedStaffAccounts: settings.includedStaffAccounts,
    supportSlaHours: settings.supportSlaHours,
    loginAttemptLimit: settings.loginAttemptLimit,
    sessionLifetimeMinutes: settings.sessionLifetimeMinutes,
    sensitiveActionReauthMinutes: settings.sensitiveActionReauthMinutes,
    auditRetentionDays: settings.auditRetentionDays,
    dataRetentionDays: settings.dataRetentionDays,
    allowedUploadTypes: settings.allowedUploadTypes,
    updatedById: settings.updatedById,
    updatedAt: settings.updatedAt.toISOString(),
  };
}

export async function ensurePlatformGovernanceSettings() {
  const existing = await prisma.platformGovernanceSettings.findUnique({
    where: { id: PLATFORM_GOVERNANCE_ID },
  });
  if (existing) return serializePlatformGovernance(existing);

  try {
    const created = await prisma.platformGovernanceSettings.create({
      data: {
        id: PLATFORM_GOVERNANCE_ID,
        platformName: DEFAULT_PLATFORM_GOVERNANCE.platformName,
        defaultCountry: DEFAULT_PLATFORM_GOVERNANCE.defaultCountry,
        defaultCurrency: DEFAULT_PLATFORM_GOVERNANCE.defaultCurrency,
        defaultTimezone: DEFAULT_PLATFORM_GOVERNANCE.defaultTimezone,
        marketplaceEnabled: DEFAULT_PLATFORM_GOVERNANCE.marketplaceEnabled,
        publicApplicationsEnabled: DEFAULT_PLATFORM_GOVERNANCE.publicApplicationsEnabled,
        maintenanceMode: DEFAULT_PLATFORM_GOVERNANCE.maintenanceMode,
        incidentMode: DEFAULT_PLATFORM_GOVERNANCE.incidentMode,
        paymentsEnabled: DEFAULT_PLATFORM_GOVERNANCE.paymentsEnabled,
        messagingEnabled: DEFAULT_PLATFORM_GOVERNANCE.messagingEnabled,
        signupsEnabled: DEFAULT_PLATFORM_GOVERNANCE.signupsEnabled,
        trialDays: DEFAULT_PLATFORM_GOVERNANCE.trialDays,
        includedStaffAccounts: DEFAULT_PLATFORM_GOVERNANCE.includedStaffAccounts,
        supportSlaHours: DEFAULT_PLATFORM_GOVERNANCE.supportSlaHours,
        loginAttemptLimit: DEFAULT_PLATFORM_GOVERNANCE.loginAttemptLimit,
        sessionLifetimeMinutes: DEFAULT_PLATFORM_GOVERNANCE.sessionLifetimeMinutes,
        sensitiveActionReauthMinutes: DEFAULT_PLATFORM_GOVERNANCE.sensitiveActionReauthMinutes,
        auditRetentionDays: DEFAULT_PLATFORM_GOVERNANCE.auditRetentionDays,
        dataRetentionDays: DEFAULT_PLATFORM_GOVERNANCE.dataRetentionDays,
        allowedUploadTypes: DEFAULT_PLATFORM_GOVERNANCE.allowedUploadTypes,
      },
    });
    return serializePlatformGovernance(created);
  } catch {
    const concurrent = await prisma.platformGovernanceSettings.findUniqueOrThrow({
      where: { id: PLATFORM_GOVERNANCE_ID },
    });
    return serializePlatformGovernance(concurrent);
  }
}
