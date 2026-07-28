export const PLATFORM_GOVERNANCE_ID = "platform";

export const DEFAULT_PLATFORM_GOVERNANCE = {
  id: PLATFORM_GOVERNANCE_ID,
  platformName: "Eugene Jersey Management",
  legalCompanyName: "",
  supportEmail: "",
  supportPhone: "",
  defaultCountry: "Ghana",
  defaultCurrency: "GHS",
  defaultTimezone: "Africa/Accra",
  termsVersion: "",
  privacyVersion: "",
  marketplaceEnabled: true,
  publicApplicationsEnabled: false,
  maintenanceMode: false,
  incidentMode: false,
  paymentsEnabled: true,
  messagingEnabled: true,
  signupsEnabled: true,
  maintenanceNotice: "",
  trialDays: 14,
  includedStaffAccounts: 3,
  supportSlaHours: 24,
  loginAttemptLimit: 5,
  sessionLifetimeMinutes: 10_080,
  sensitiveActionReauthMinutes: 15,
  auditRetentionDays: 2_555,
  dataRetentionDays: 2_555,
  allowedUploadTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "application/pdf"],
  updatedById: null as string | null,
  updatedAt: null as string | null,
};

export type PlatformGovernanceSettingsData = typeof DEFAULT_PLATFORM_GOVERNANCE;
type GovernanceValue = string | number | boolean | null | string[];
export type GovernanceChangeSet = Record<string, { previous: GovernanceValue; next: GovernanceValue }>;

const editableKeys = [
  "platformName",
  "legalCompanyName",
  "supportEmail",
  "supportPhone",
  "defaultCountry",
  "defaultCurrency",
  "defaultTimezone",
  "termsVersion",
  "privacyVersion",
  "marketplaceEnabled",
  "publicApplicationsEnabled",
  "maintenanceMode",
  "incidentMode",
  "paymentsEnabled",
  "messagingEnabled",
  "signupsEnabled",
  "maintenanceNotice",
  "trialDays",
  "includedStaffAccounts",
  "supportSlaHours",
  "loginAttemptLimit",
  "sessionLifetimeMinutes",
  "sensitiveActionReauthMinutes",
  "auditRetentionDays",
  "dataRetentionDays",
  "allowedUploadTypes",
] as const;

export function governanceChanges(
  previous: PlatformGovernanceSettingsData,
  next: PlatformGovernanceSettingsData,
): GovernanceChangeSet {
  const changes: GovernanceChangeSet = {};
  for (const key of editableKeys) {
    const previousValue = previous[key] as GovernanceValue;
    const nextValue = next[key] as GovernanceValue;
    if (JSON.stringify(previousValue) !== JSON.stringify(nextValue)) {
      changes[key] = { previous: previousValue, next: nextValue };
    }
  }
  return changes;
}
