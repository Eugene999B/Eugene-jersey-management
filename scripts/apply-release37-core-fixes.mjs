import fs from "node:fs";

function patch(file, before, after) {
  const source = fs.readFileSync(file, "utf8");
  if (!source.includes(before)) throw new Error(`Core patch anchor not found in ${file}: ${before.slice(0, 140)}`);
  fs.writeFileSync(file, source.replace(before, after), "utf8");
}

patch(
  "src/lib/subscription-hardening.ts",
  'import "server-only";\n\n',
  "",
);

patch(
  "src/lib/subscription-hardening.ts",
  `export async function commercialSubscriptionState(shopId: string, now = new Date()) {\n  return commercialStateFromDb(platformDb, shopId, now);\n}\n\nexport function subscriptionFeatureIncluded`,
  `export async function commercialSubscriptionState(shopId: string, now = new Date()) {\n  return commercialStateFromDb(platformDb, shopId, now);\n}\n\nexport async function assertCommercialOperationAvailable(shopId: string, now = new Date()) {\n  const state = await commercialSubscriptionState(shopId, now);\n  assertOperational(state);\n  return state;\n}\n\nexport function subscriptionFeatureIncluded`,
);

patch(
  "src/lib/subscription-entitlements.ts",
  'import { parseSubscriptionPlanSnapshot, subscriptionPlanSnapshot, type SubscriptionPlanSnapshot } from "@/lib/subscription-plans";\n',
  'import { parseSubscriptionPlanSnapshot, subscriptionPlanSnapshot, type SubscriptionPlanSnapshot } from "@/lib/subscription-plans";\nimport { assertCommercialOperationAvailable } from "@/lib/subscription-hardening";\n',
);

patch(
  "src/lib/subscription-entitlements.ts",
  `}): Promise<User> {\n  return platformDb.$transaction(async (tx) => {\n    const existing`,
  `}): Promise<User> {\n  await assertCommercialOperationAvailable(input.shopId);\n  return platformDb.$transaction(async (tx) => {\n    const existing`,
);

patch(
  "src/lib/subscription-entitlements.ts",
  `export async function toggleStaffAccessWithinPlan(input: { shopId: string; userId: string }): Promise<User> {\n  return platformDb.$transaction(async (tx) => {`,
  `export async function toggleStaffAccessWithinPlan(input: { shopId: string; userId: string }): Promise<User> {\n  const current = await platformDb.user.findFirst({ where: { id: input.userId, shopId: input.shopId }, select: { isActive: true, role: true } });\n  if (current && !current.isActive && current.role !== Role.OWNER) await assertCommercialOperationAvailable(input.shopId);\n  return platformDb.$transaction(async (tx) => {`,
);

patch(
  "src/lib/subscription-entitlements.ts",
  `}): Promise<InviteToken> {\n  return platformDb.$transaction(async (tx) => {\n    const existing`,
  `}): Promise<InviteToken> {\n  await assertCommercialOperationAvailable(input.shopId);\n  return platformDb.$transaction(async (tx) => {\n    const existing`,
);

patch(
  "src/lib/subscription-entitlements.ts",
  `}): Promise<{ user: User; invite: InviteToken }> {\n  return platformDb.$transaction(async (tx) => {`,
  `}): Promise<{ user: User; invite: InviteToken }> {\n  const pendingInvite = await platformDb.inviteToken.findUnique({ where: { tokenHash: input.tokenHash }, select: { shopId: true, usedAt: true, expiresAt: true } });\n  if (pendingInvite && !pendingInvite.usedAt && pendingInvite.expiresAt > new Date()) {\n    await assertCommercialOperationAvailable(pendingInvite.shopId);\n  }\n  return platformDb.$transaction(async (tx) => {`,
);

patch(
  "src/app/admin/billing/actions.ts",
  `  if (!shop || !plan) billingRedirect("assignment-missing");\n  if (!plan.isConfigured || !plan.isActive) billingRedirect("plan-not-assignable");\n  const selectedPrice`,
  `  if (!shop || !plan) billingRedirect("assignment-missing");\n  if (!plan.isConfigured || !plan.isActive) billingRedirect("plan-not-assignable");\n  if ((parsed.data.subscriptionStatus === SubscriptionStatus.ACTIVE || parsed.data.subscriptionStatus === SubscriptionStatus.PAST_DUE) && !parsed.data.renewalAt) {\n    billingRedirect("renewal-date-required");\n  }\n  const selectedPrice`,
);

patch(
  "src/app/admin/billing/page.tsx",
  `  "plan-not-assignable": "Only configured and active plans can be assigned to a tenant.",\n};`,
  `  "plan-not-assignable": "Only configured and active plans can be assigned to a tenant.",\n  "renewal-date-required": "Active and past-due subscriptions require a renewal date so grace and suspension can be calculated safely.",\n};`,
);

fs.writeFileSync("scripts/apply-release37-core-fixes.mjs", fs.readFileSync("scripts/apply-release37-core-fixes.mjs", "utf8"), "utf8");
console.log("Release 37 core commercial fixes applied.");
