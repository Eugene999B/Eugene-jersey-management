import "server-only";

import { redirect } from "next/navigation";
import {
  OPTIONAL_BUSINESS_MODULES,
  businessModuleEnabled,
  type BusinessModuleKey,
} from "@/lib/business-modules";
import { platformDb } from "@/lib/platform-db";
import {
  commercialSubscriptionState,
  subscriptionFeatureIncluded,
} from "@/lib/subscription-hardening";

export async function businessModuleAccessForShop(shopId: string, key: BusinessModuleKey) {
  const definition = OPTIONAL_BUSINESS_MODULES.find((module) => module.key === key);
  const [shop, subscription] = await Promise.all([
    platformDb.shop.findUnique({ where: { id: shopId }, select: { enabledModules: true } }),
    commercialSubscriptionState(shopId),
  ]);
  const enabled = shop ? businessModuleEnabled(shop.enabledModules, key) : false;
  const featureIncluded = !definition?.requiredFeature
    || subscriptionFeatureIncluded(subscription, definition.requiredFeature);

  return {
    definition,
    enabled,
    featureIncluded,
    operational: subscription.operational,
    blockCode: subscription.blockCode,
  };
}

export async function requireBusinessModuleAccess(shopId: string, key: BusinessModuleKey) {
  const access = await businessModuleAccessForShop(shopId, key);
  if (!access.operational) {
    redirect(`/dashboard/subscription?error=${encodeURIComponent(access.blockCode ?? "subscription")}`);
  }
  if (!access.enabled) {
    redirect(`/dashboard/subscription?error=module&module=${encodeURIComponent(key)}`);
  }
  if (!access.featureIncluded) {
    redirect(`/dashboard/subscription?error=feature&feature=${encodeURIComponent(access.definition?.requiredFeature ?? "PLAN_FEATURE")}`);
  }
  return access;
}
