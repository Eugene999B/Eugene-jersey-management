import { ShopVerificationStatus } from "@prisma/client";

export type PublicShopAccess = {
  isActive: boolean;
  verificationStatus: ShopVerificationStatus;
  storefrontEnabled: boolean;
  publicOrderingEnabled: boolean;
  enabledModules: string[];
};

export function publicShopAcceptsOrders(shop: PublicShopAccess, requiredModules: readonly string[] = ["ONLINE_SELLING"]) {
  return shop.isActive
    && shop.verificationStatus === ShopVerificationStatus.VERIFIED
    && shop.storefrontEnabled
    && shop.publicOrderingEnabled
    && requiredModules.every((module) => shop.enabledModules.includes(module));
}
