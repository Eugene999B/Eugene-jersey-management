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
  parseCommunicationCreditPackageSnapshot,
} from "@/lib/communication-credits";
import { prisma } from "@/lib/db";
import { requirePlatformPermission } from "@/lib/platform-admin";
import { canApproveCommercialChange } from "@/lib/subscription-plans";

const packageShellSchema = z.object({
  code: z.string().trim().min(3).max(60).transform((value) => value.toUpperCase().replace(/[^A-Z0-9-]/g, "-")),
  channel: z.nativeEnum(CommunicationCreditChannel),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500),
});

const optionalPositiveInt = z.number().int().positive().max(10_000_000).nullable();
const packageProposalSchema = z.object({
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

const decisionSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(["APPROVE", "REJECT"]),
  decisionNote: z.string().trim().min(5).max(500),
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

export async function requestCommunicationPackageChangeAction(formData: FormData) {
  const session = await requirePlatformPermission("billing");
  const parsed = packageProposalSchema.safeParse({
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
  const existingPending = await prisma.communicationCreditPackageChangeRequest.findFirst({
    where: { packageId: creditPackage.id, status: CommunicationCreditPackageChangeStatus.PENDING },
    select: { id: true },
  });
  if (existingPending) communicationRedirect("pending-package-change");

  const previous = communicationCreditPackageSnapshot(creditPackage);
  const proposed = {
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

  const request = await prisma.communicationCreditPackageChangeRequest.create({
    data: {
      packageId: creditPackage.id,
      baseVersion: creditPackage.version,
      reason: parsed.data.reason,
      previousSnapshot: communicationCreditSnapshotAsJson(previous),
      proposedSnapshot: communicationCreditSnapshotAsJson(proposed),
      requestedById: session.id,
    },
  });
  await audit({
    userId: session.id,
    action: "admin.communication_credit_package_change_requested",
    entityType: "CommunicationCreditPackageChangeRequest",
    entityId: request.id,
    metadata: {
      packageId: creditPackage.id,
      code: creditPackage.code,
      baseVersion: creditPackage.version,
      proposedVersion: proposed.version,
      reason: parsed.data.reason,
    },
  });
  revalidatePath("/admin/billing/communications");
  redirect("/admin/billing/communications?requested=1");
}

export async function decideCommunicationPackageChangeAction(formData: FormData) {
  const session = await requirePlatformPermission("billing");
  const parsed = decisionSchema.safeParse({
    requestId: formData.get("requestId"),
    decision: formData.get("decision"),
    decisionNote: formData.get("decisionNote"),
  });
  if (!parsed.success) communicationRedirect("decision-values");

  const request = await prisma.communicationCreditPackageChangeRequest.findUnique({
    where: { id: parsed.data.requestId },
    include: { package: true },
  });
  if (!request || request.status !== CommunicationCreditPackageChangeStatus.PENDING) communicationRedirect("request-state");
  if (!canApproveCommercialChange(request.requestedById, session.id)) communicationRedirect("self-approval");

  if (parsed.data.decision === "REJECT") {
    const rejected = await prisma.communicationCreditPackageChangeRequest.updateMany({
      where: { id: request.id, status: CommunicationCreditPackageChangeStatus.PENDING },
      data: {
        status: CommunicationCreditPackageChangeStatus.REJECTED,
        decisionNote: parsed.data.decisionNote,
        decidedById: session.id,
        decidedAt: new Date(),
      },
    });
    if (rejected.count !== 1) communicationRedirect("request-state");
    await audit({
      userId: session.id,
      action: "admin.communication_credit_package_change_rejected",
      entityType: "CommunicationCreditPackageChangeRequest",
      entityId: request.id,
      metadata: { packageId: request.packageId, requestedById: request.requestedById, decisionNote: parsed.data.decisionNote },
    });
    revalidatePath("/admin/billing/communications");
    redirect("/admin/billing/communications?rejected=1");
  }

  const proposed = parseCommunicationCreditPackageSnapshot(request.proposedSnapshot);
  if (!proposed.success || proposed.data.version !== request.baseVersion + 1) communicationRedirect("proposal-corrupt");
  const applied = await prisma.$transaction(async (tx) => {
    const claimed = await tx.communicationCreditPackageChangeRequest.updateMany({
      where: { id: request.id, status: CommunicationCreditPackageChangeStatus.PENDING },
      data: {
        status: CommunicationCreditPackageChangeStatus.APPROVED,
        decisionNote: parsed.data.decisionNote,
        decidedById: session.id,
        decidedAt: new Date(),
      },
    });
    if (claimed.count !== 1) throw new Error("REQUEST_STATE");

    const changed = await tx.communicationCreditPackage.updateMany({
      where: { id: request.packageId, version: request.baseVersion },
      data: {
        name: proposed.data.name,
        description: proposed.data.description || null,
        currency: proposed.data.currency,
        price: proposed.data.price,
        creditUnits: proposed.data.creditUnits,
        bonusUnits: proposed.data.bonusUnits,
        isConfigured: proposed.data.isConfigured,
        isPublic: proposed.data.isPublic,
        isActive: proposed.data.isActive,
        version: proposed.data.version,
        updatedById: session.id,
      },
    });
    if (changed.count !== 1) throw new Error("STALE_PACKAGE");
    await tx.communicationCreditPackageVersion.create({
      data: {
        packageId: request.packageId,
        version: proposed.data.version,
        snapshot: communicationCreditSnapshotAsJson(proposed.data),
        reason: request.reason,
        approvedById: session.id,
      },
    });
    return proposed.data;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch(() => null);
  if (!applied) communicationRedirect("stale-package");

  await audit({
    userId: session.id,
    action: "admin.communication_credit_package_change_approved",
    entityType: "CommunicationCreditPackage",
    entityId: request.packageId,
    metadata: {
      requestId: request.id,
      requestedById: request.requestedById,
      approvedVersion: applied.version,
      decisionNote: parsed.data.decisionNote,
    },
  });
  revalidatePath("/admin/billing/communications");
  revalidatePath("/dashboard/messages");
  redirect("/admin/billing/communications?approved=1");
}
