import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import {
  defaultConnectionModeForOutput,
  machineProfileCompatibilityError,
} from "@/lib/design-device-readiness";
import {
  MACHINE_CONNECTION_MODES,
  MACHINE_DEVICE_TYPES,
  MACHINE_ORIGINS,
  MACHINE_OUTPUT_FORMATS,
} from "@/lib/design-machine-profile";
import { ensureShopMachineProfiles, serializeMachineProfile } from "@/lib/design-machine-profile-server";
import { prisma } from "@/lib/db";
import { permissions } from "@/lib/rbac";
import { isTrustedApplicationOrigin } from "@/lib/request-origin";

const profileFields = z.object({
  name: z.string().trim().min(2).max(80),
  manufacturer: z.string().trim().max(80).nullable().optional(),
  model: z.string().trim().max(80).nullable().optional(),
  deviceType: z.enum(MACHINE_DEVICE_TYPES).optional(),
  connectionMode: z.enum(MACHINE_CONNECTION_MODES).optional(),
  outputFormat: z.enum(MACHINE_OUTPUT_FORMATS),
  bedWidthMm: z.number().finite().min(20).max(2_000),
  bedHeightMm: z.number().finite().min(20).max(5_000),
  unitsPerMm: z.number().int().min(1).max(1_000),
  baudRate: z.number().int().min(300).max(1_000_000),
  usbVendorId: z.number().int().min(0).max(65_535).nullable().optional(),
  usbProductId: z.number().int().min(0).max(65_535).nullable().optional(),
  origin: z.enum(MACHINE_ORIGINS),
  mirrorDefault: z.boolean(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
});

const updateSchema = profileFields.extend({ id: z.string().min(1).max(100) });
const deleteSchema = z.object({ id: z.string().min(1).max(100) });

type ParsedProfile = z.infer<typeof profileFields>;

function completeProfileData(data: ParsedProfile) {
  const profile = {
    ...data,
    manufacturer: data.manufacturer?.trim() || null,
    model: data.model?.trim() || null,
    deviceType: data.deviceType ?? "CUTTER_PLOTTER",
    connectionMode: data.connectionMode ?? defaultConnectionModeForOutput(data.outputFormat),
    usbVendorId: data.usbVendorId ?? null,
    usbProductId: data.usbProductId ?? null,
  };
  return { profile, compatibilityError: machineProfileCompatibilityError(profile) };
}

function profileError(error: unknown) {
  if (error instanceof Error && error.message.includes("EJM_MACHINE_PROFILE_HAS_OPEN_JOBS")) {
    return NextResponse.json({
      error: "This machine profile still has prepared, sending, or failed cutter jobs. Finish or cancel those jobs before deactivating the machine.",
      code: "MACHINE_PROFILE_HAS_OPEN_JOBS",
    }, { status: 409 });
  }
  if (error instanceof Error && error.message.includes("EJM_MACHINE_PROFILE_HAS_HISTORY")) {
    return NextResponse.json({
      error: "This machine profile has cutter production history and cannot be deleted. Deactivate it after all open jobs are finished or cancelled.",
      code: "MACHINE_PROFILE_HAS_HISTORY",
    }, { status: 409 });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json({ error: "A machine profile with this name already exists in this shop." }, { status: 409 });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
    return NextResponse.json({
      error: "This machine profile is referenced by production history and cannot be deleted. Deactivate it instead.",
      code: "MACHINE_PROFILE_HAS_HISTORY",
    }, { status: 409 });
  }
  throw error;
}

async function requireShopSettings(request: NextRequest) {
  const session = await requireRole(permissions.settings);
  if (!session.shopId) return { response: NextResponse.json({ error: "A shop workspace is required." }, { status: 403 }) };
  if (!isTrustedApplicationOrigin(request)) return { response: NextResponse.json({ error: "Invalid request origin." }, { status: 403 }) };
  return { session, shopId: session.shopId };
}

export async function GET() {
  const session = await requireRole(permissions.designs);
  if (!session.shopId) return NextResponse.json({ error: "A shop workspace is required." }, { status: 403 });
  const profiles = await ensureShopMachineProfiles(session.shopId);
  return NextResponse.json({ profiles });
}

export async function POST(request: NextRequest) {
  const access = await requireShopSettings(request);
  if ("response" in access) return access.response;
  const parsed = profileFields.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the machine identity, bed size and output settings." }, { status: 400 });
  const { profile: profileData, compatibilityError } = completeProfileData(parsed.data);
  if (compatibilityError) return NextResponse.json({ error: compatibilityError }, { status: 400 });

  try {
    const profile = await prisma.$transaction(async (transaction) => {
      const count = await transaction.shopMachineProfile.count({ where: { shopId: access.shopId } });
      const makeDefault = count === 0 || profileData.isDefault;
      if (makeDefault) {
        await transaction.shopMachineProfile.updateMany({ where: { shopId: access.shopId, isDefault: true }, data: { isDefault: false } });
      }
      return transaction.shopMachineProfile.create({
        data: { ...profileData, shopId: access.shopId, isDefault: makeDefault },
      });
    });

    await audit({
      shopId: access.shopId,
      userId: access.session.id,
      action: "design.machine-profile.created",
      entityType: "ShopMachineProfile",
      entityId: profile.id,
      metadata: {
        name: profile.name,
        manufacturer: profile.manufacturer,
        model: profile.model,
        deviceType: profile.deviceType,
        connectionMode: profile.connectionMode,
        outputFormat: profile.outputFormat,
        isDefault: profile.isDefault,
      },
    });
    return NextResponse.json({ profile: serializeMachineProfile(profile) }, { status: 201 });
  } catch (error) {
    return profileError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const access = await requireShopSettings(request);
  if ("response" in access) return access.response;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the machine identity, bed size and output settings." }, { status: 400 });
  const { id, ...rawProfileData } = parsed.data;
  const { profile: profileData, compatibilityError } = completeProfileData(rawProfileData);
  if (compatibilityError) return NextResponse.json({ error: compatibilityError }, { status: 400 });

  try {
    const profile = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.shopMachineProfile.findFirst({ where: { id, shopId: access.shopId } });
      if (!existing) return null;
      const activeCount = await transaction.shopMachineProfile.count({ where: { shopId: access.shopId, isActive: true } });
      if (existing.isActive && !profileData.isActive && activeCount <= 1) {
        throw new Error("A shop must keep at least one active machine profile.");
      }

      const makeDefault = profileData.isDefault || existing.isDefault;
      if (makeDefault) {
        await transaction.shopMachineProfile.updateMany({
          where: { shopId: access.shopId, isDefault: true, id: { not: existing.id } },
          data: { isDefault: false },
        });
      }
      return transaction.shopMachineProfile.update({
        where: { id: existing.id },
        data: { ...profileData, isDefault: makeDefault, isActive: makeDefault ? true : profileData.isActive },
      });
    });
    if (!profile) return NextResponse.json({ error: "Machine profile not found." }, { status: 404 });

    await audit({
      shopId: access.shopId,
      userId: access.session.id,
      action: "design.machine-profile.updated",
      entityType: "ShopMachineProfile",
      entityId: profile.id,
      metadata: {
        name: profile.name,
        manufacturer: profile.manufacturer,
        model: profile.model,
        deviceType: profile.deviceType,
        connectionMode: profile.connectionMode,
        outputFormat: profile.outputFormat,
        isDefault: profile.isDefault,
        isActive: profile.isActive,
      },
    });
    return NextResponse.json({ profile: serializeMachineProfile(profile) });
  } catch (error) {
    if (error instanceof Error && error.message === "A shop must keep at least one active machine profile.") {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return profileError(error);
  }
}

export async function DELETE(request: NextRequest) {
  const access = await requireShopSettings(request);
  if ("response" in access) return access.response;
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid machine profile." }, { status: 400 });

  try {
    const deleted = await prisma.$transaction(async (transaction) => {
      const profiles = await transaction.shopMachineProfile.findMany({
        where: { shopId: access.shopId },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      });
      const existing = profiles.find((profile) => profile.id === parsed.data.id);
      if (!existing) return null;
      if (profiles.length <= 1) throw new Error("A shop must keep at least one machine profile.");
      await transaction.shopMachineProfile.delete({ where: { id: existing.id } });
      if (existing.isDefault) {
        const replacement = profiles.find((profile) => profile.id !== existing.id && profile.isActive)
          ?? profiles.find((profile) => profile.id !== existing.id);
        if (replacement) {
          await transaction.shopMachineProfile.update({ where: { id: replacement.id }, data: { isDefault: true, isActive: true } });
        }
      }
      return existing;
    });
    if (!deleted) return NextResponse.json({ error: "Machine profile not found." }, { status: 404 });

    await audit({
      shopId: access.shopId,
      userId: access.session.id,
      action: "design.machine-profile.deleted",
      entityType: "ShopMachineProfile",
      entityId: deleted.id,
      metadata: {
        name: deleted.name,
        manufacturer: deleted.manufacturer,
        model: deleted.model,
        deviceType: deleted.deviceType,
        connectionMode: deleted.connectionMode,
        outputFormat: deleted.outputFormat,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "A shop must keep at least one machine profile.") {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return profileError(error);
  }
}