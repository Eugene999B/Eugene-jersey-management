"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  CommunicationCreditChannel,
  CommunicationCreditPackageChangeStatus,
  Prisma,
} from "@prisma/client";
import { z } from "zod";
import { audit } from "@/lib/audit";
import {
  communicationCreditPackageSnapshot,
  communicationCreditSnapshotAsJson,
} from "@/lib/communication-credits";
import { prisma } from "@/lib/db";
import { requirePlatformPermission } from "@/lib/platform-admin";

const packageShellSchema = z.object({
  code: z.string().trim().min(3).max(60).transform((value) => value.toUpperCase().replace(/[^A-Z0-9-]/g, "-")),
  channel: z.nativeEnum(CommunicationCreditChannel),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500),
});

const optionalPositiveInt = z.number().int().positive().max(10_000_000).nullable();
const packageSchema = z.object({
  packageId: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  price: z.number().min(0).max(100_000_000).nullable(),
  creditUnits: optionalPositiveInt,
  bonusUnits: z.number().int().min(0).max(10_000_000),
  isConfigured: z.boolean(),
  isPublic: z.boolean(),
  isActive: z.boolean(),
  reason: z.string().trim().min(8).max(500),
});

function numberOrNull(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function communicationRedirect(error: string): never {
  redirect(`/admin/billing/communications?error=${encodeURIComponent(error)}`);
}

export async function createCommunicationPackageShellAction(formData: FormData) {
  const session = await requirePlatformPermission("billing");
  const parsed = packageShellSchema.safeParse({
    code: formData.get("code"),
    channel: formData.get("channel"),
    name: formData.get("name"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) communicationRedirect("shell-values");

  const existing = await prisma.communicationCreditPackage.findUnique({ where: { code: parsed.data.code } });
  if (existing) communicationRedirect("shell-code");

  const creditPackage = await prisma.$transaction(async (tx) => {
    const created = await tx.communicationCreditPackage.create({
      data: {
        ...parsed.data,
        currency: "GHS",
        isConfigured: false,
        isPublic: false,
        isActive: false,
        version: 1,
        createdById: session.id,
        updatedById: session.id,
      },
    });
    await tx.communicationCreditPackageVersion.create({
      data: {
        packageId: created.id,
        version: 1,
        snapshot: communicationCreditSnapshotAsJson(communicationCreditPackageSnapshot(created)),
        reason: "Inactive package shell created without commercial price or credit quantity.",
        approvedById: session.id,
      },
    });
    return created;
  });

  await audit({
    userId: session.id,
    action: "admin.communication_credit_package_shell_created",
    entityType: "CommunicationCreditPackage",
    entityId: creditPackage.id,
    metadata: { code: creditPackage.code, channel: creditPackage.channel },
  });
  revalidatePath("/admin/billing/communications");
  redirect("/admin/billing/communications?created=1");
}

export async function saveCommunicationPackageAction(formData: FormData) {
  const session = await requirePlatformPermission("billing");
  const parsed = packageSchema.safeParse({
    packageId: formData.get("packageId"),
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    currency: formData.get("currency"),
    price: numberOrNull(formData.get("price")),
    creditUnits: numberOrNull(formData.get("creditUnits")),
    bonusUnits: numberOrNull(formData.get("bonusUnits")) ?? 0,
    isConfigured: formData.get("isConfigured") === "on",
    isPublic: formData.get("isPublic") === "on",
    isActive: formData.get("isActive") === "on",
    reason: formData.get("reason"),
  });
  if (!parsed.success) communicationRedirect("package-values");
  if (parsed.data.isConfigured && (parsed.data.price === null || parsed.data.price <= 0 || parsed.data.creditUnits === null)) {
    communicationRedirect("configured-package-values");
  }
  if (parsed.data.isPublic && (!parsed.data.isConfigured || !parsed.data.isActive)) {
    communicationRedirect("public-package-state");
  }

  const creditPackage = await prisma.communicationCreditPackage.findUnique({ where: { id: parsed.data.packageId } });
  if (!creditPackage) communicationRedirect("package-missing");

  const previous = communicationCreditPackageSnapshot(creditPackage);
  const next = {
    ...previous,
    name: parsed.data.name,
    description: parsed.data.description,
    currency: parsed.data.currency,
    price: parsed.data.price === null ? null : parsed.data.price.toFixed(2),
    creditUnits: parsed.data.creditUnits,
    bonusUnits: parsed.data.bonusUnits,
    isConfigured: parsed.data.isConfigured,
    isPublic: parsed.data.isPublic,
    isActive: parsed.data.isActive,
    version: creditPackage.version + 1,
  };
  const decidedAt = new Date();

  const applied = await prisma.$transaction(async (tx) => {
    const changed = await tx.communicationCreditPackage.updateMany({
      where: { id: creditPackage.id, version: creditPackage.version },
      data: {
        name: next.name,
        description: next.description || null,
        currency: next.currency,
        price: next.price,
        creditUnits: next.creditUnits,
        bonusUnits: next.bonusUnits,
        isConfigured: next.isConfigured,
        isPublic: next.isPublic,
        isActive: next.isActive,
        version: next.version,
        updatedById: session.id,
      },
    });
    if (changed.count !== 1) throw new Error("STALE_PACKAGE");

    const change = await tx.communicationCreditPackageChangeRequest.create({
      data: {
        packageId: creditPackage.id,
        baseVersion: creditPackage.version,
        status: CommunicationCreditPackageChangeStatus.APPROVED,
        reason: parsed.data.reason,
        decisionNote: "Applied immediately by the authenticated platform administrator.",
        previousSnapshot: communicationCreditSnapshotAsJson(previous),
        proposedSnapshot: communicationCreditSnapshotAsJson(next),
        requestedById: session.id,
        decidedById: session.id,
        decidedAt,
      },
    });
    await tx.communicationCreditPackageVersion.create({
      data: {
        packageId: creditPackage.id,
        version: next.version,
        snapshot: communicationCreditSnapshotAsJson(next),
        reason: parsed.data.reason,
        approvedById: session.id,
      },
    });
    return change;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch(() => null);
  if (!applied) communicationRedirect("stale-package");

  await audit({
    userId: session.id,
    action: "admin.communication_credit_package_updated",
    entityType: "CommunicationCreditPackage",
    entityId: creditPackage.id,
    metadata: {
      changeRequestId: applied.id,
      code: creditPackage.code,
      previousVersion: creditPackage.version,
      savedVersion: next.version,
      reason: parsed.data.reason,
      appliedImmediately: true,
    },
  });
  revalidatePath("/admin/billing/communications");
  revalidatePath("/dashboard/messages");
  redirect("/admin/billing/communications?saved=1");
}
