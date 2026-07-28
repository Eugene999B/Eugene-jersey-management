import "server-only";
import type { ShopMachineProfile } from "@prisma/client";
import {
  DEFAULT_MACHINE_PROFILE_INPUT,
  normalizeMachineConnectionMode,
  normalizeMachineDeviceType,
  normalizeMachineOrigin,
  normalizeMachineOutputFormat,
  type DesignMachineProfile,
} from "@/lib/design-machine-profile";
import { prisma } from "@/lib/db";

export function serializeMachineProfile(profile: ShopMachineProfile): DesignMachineProfile {
  const outputFormat = normalizeMachineOutputFormat(profile.outputFormat);
  return {
    id: profile.id,
    name: profile.name,
    manufacturer: profile.manufacturer,
    model: profile.model,
    deviceType: normalizeMachineDeviceType(profile.deviceType),
    connectionMode: normalizeMachineConnectionMode(profile.connectionMode, outputFormat),
    outputFormat,
    bedWidthMm: profile.bedWidthMm,
    bedHeightMm: profile.bedHeightMm,
    unitsPerMm: profile.unitsPerMm,
    baudRate: profile.baudRate,
    usbVendorId: profile.usbVendorId,
    usbProductId: profile.usbProductId,
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
