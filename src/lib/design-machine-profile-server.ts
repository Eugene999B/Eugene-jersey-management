import "server-only";
import type { ShopMachineProfile } from "@prisma/client";
import {
  DEFAULT_MACHINE_PROFILE_INPUT,
  normalizeMachineOrigin,
  normalizeMachineOutputFormat,
  type DesignMachineProfile,
} from "@/lib/design-machine-profile";
import { prisma } from "@/lib/db";

export function serializeMachineProfile(profile: ShopMachineProfile): DesignMachineProfile {
  return {
    id: profile.id,
    name: profile.name,
    outputFormat: normalizeMachineOutputFormat(profile.outputFormat),
    bedWidthMm: profile.bedWidthMm,
    bedHeightMm: profile.bedHeightMm,
    unitsPerMm: profile.unitsPerMm,
    baudRate: profile.baudRate,
    origin: normalizeMachineOrigin(profile.origin),
    mirrorDefault: profile.mirrorDefault,
    isDefault: profile.isDefault,
    isActive: profile.isActive,
  };
}

export async function ensureShopMachineProfiles(shopId: string) {
  const existing = await prisma.shopMachineProfile.findMany({
    where: { shopId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  if (existing.length) return existing.map(serializeMachineProfile);

  try {
    await prisma.shopMachineProfile.create({
      data: { shopId, ...DEFAULT_MACHINE_PROFILE_INPUT },
    });
  } catch {
    // A concurrent first visit may have created the default already.
  }

  return (await prisma.shopMachineProfile.findMany({
    where: { shopId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  })).map(serializeMachineProfile);
}
