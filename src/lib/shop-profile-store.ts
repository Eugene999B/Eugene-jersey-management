import "server-only";

import type { Prisma } from "@prisma/client";
import { platformDb } from "@/lib/platform-db";

type ShopLocationData = {
  country: string;
  region: string;
  district: string;
  town: string;
  area: string | null;
  digitalAddress: string | null;
  streetAddress: string | null;
  landmark: string | null;
  latitude: number | null;
  longitude: number | null;
  searchText: string;
};

export async function readShopProfileState(shopId: string) {
  return Promise.all([
    platformDb.shop.findUnique({ where: { id: shopId }, select: { isActive: true, slug: true } }),
    platformDb.shopMarketplaceProfile.findUnique({ where: { shopId } }),
    platformDb.shopLocation.findUnique({ where: { shopId } }),
  ]);
}

export async function readShopSettingsProfile(shopId: string, userId: string) {
  return Promise.all([
    platformDb.shopPaymentConfig.findUnique({ where: { shopId } }),
    platformDb.user.findUnique({ where: { id: userId, shopId }, select: { adminLoginId: true } }),
    platformDb.shopMarketplaceProfile.findUnique({ where: { shopId } }),
    platformDb.shopLocation.findUnique({ where: { shopId } }),
  ]);
}

export async function saveShopProfileBundle(input: {
  shopId: string;
  shopData: Prisma.ShopUpdateInput;
  marketplace: { tagline: string | null; heroImageUrl: string | null };
  location: ShopLocationData | null;
}) {
  return platformDb.$transaction(async (tx) => {
    await tx.shop.update({
      where: { id: input.shopId },
      data: input.shopData,
    });
    await tx.shopMarketplaceProfile.upsert({
      where: { shopId: input.shopId },
      create: { shopId: input.shopId, ...input.marketplace },
      update: input.marketplace,
    });
    if (input.location) {
      await tx.shopLocation.upsert({
        where: { shopId: input.shopId },
        create: { shopId: input.shopId, ...input.location },
        update: input.location,
      });
    }
  });
}
