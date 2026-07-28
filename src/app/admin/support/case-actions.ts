"use server";

import {
  Prisma,
  Role,
  SupportCaseCategory,
  SupportCasePriority,
  SupportCaseStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { platformDb } from "@/lib/platform-db";
import { requirePlatformPermission } from "@/lib/platform-admin";
import { createSupportCaseReference } from "@/lib/platform-support";

const optionalId = z.preprocess(
  (value) => {
    const text = String(value ?? "").trim();
    return text || undefined;
  },
  z.string().min(1).max(100).optional(),
);

const createCaseSchema = z.object({
  shopId: optionalId,
  subjectUserId: optionalId,
  supplierId: optionalId,
  assignedToId: optionalId,
  category: z.nativeEnum(SupportCaseCategory),
  priority: z.nativeEnum(SupportCasePriority),
  title: z.string().trim().min(4).max(160),
  summary: z.string().trim().min(10).max(5000),
  linkedEntityType: z.preprocess((value) => String(value ?? "").trim() || undefined, z.string().max(80).optional()),
  linkedEntityId: optionalId,
});

const noteSchema = z.object({
  caseId: z.string().min(1).max(100),
  body: z.string().trim().min(2).max(5000),
  isInternal: z.preprocess((value) => value === "true" || value === "on", z.boolean()),
});

const updateCaseSchema = z
  .object({
    caseId: z.string().min(1).max(100),
    expectedUpdatedAt: z.coerce.date(),
    assignedToId: optionalId,
    priority: z.nativeEnum(SupportCasePriority),
    status: z.nativeEnum(SupportCaseStatus),
    resolution: z.preprocess((value) => String(value ?? "").trim() || undefined, z.string().max(5000).optional()),
  })
  .superRefine((value, context) => {
    if ([SupportCaseStatus.RESOLVED, SupportCaseStatus.CLOSED].includes(value.status) && !value.resolution) {
      context.addIssue({ code: "custom", path: ["resolution"], message: "A resolution is required." });
    }
  });

const allowedTransitions: Record<SupportCaseStatus, readonly SupportCaseStatus[]> = {
  OPEN: [SupportCaseStatus.INVESTIGATING, SupportCaseStatus.WAITING_ON_SHOP, SupportCaseStatus.WAITING_ON_PROVIDER, SupportCaseStatus.RESOLVED, SupportCaseStatus.CLOSED],
  INVESTIGATING: [SupportCaseStatus.OPEN, SupportCaseStatus.WAITING_ON_SHOP, SupportCaseStatus.WAITING_ON_PROVIDER, SupportCaseStatus.RESOLVED, SupportCaseStatus.CLOSED],
  WAITING_ON_SHOP: [SupportCaseStatus.INVESTIGATING, SupportCaseStatus.RESOLVED, SupportCaseStatus.CLOSED],
  WAITING_ON_PROVIDER: [SupportCaseStatus.INVESTIGATING, SupportCaseStatus.RESOLVED, SupportCaseStatus.CLOSED],
  RESOLVED: [SupportCaseStatus.INVESTIGATING, SupportCaseStatus.CLOSED],
  CLOSED: [SupportCaseStatus.INVESTIGATING],
};

async function validateCaseReferences(input: z.infer<typeof createCaseSchema>) {
  const [shop, subjectUser, supplier, assignedAdmin] = await Promise.all([
    input.shopId ? platformDb.shop.findUnique({ where: { id: input.shopId }, select: { id: true } }) : null,
    input.subjectUserId ? platformDb.user.findUnique({ where: { id: input.subjectUserId }, select: { id: true, shopId: true } }) : null,
    input.supplierId ? platformDb.supplier.findUnique({ where: { id: input.supplierId }, select: { id: true, shopId: true } }) : null,
    input.assignedToId
      ? platformDb.user.findFirst({
          where: { id: input.assignedToId, role: Role.SUPER_ADMIN, shopId: null, isActive: true },
          select: { id: true },
        })
      : null,
  ]);

  if (input.shopId && !shop) return false;
  if (input.subjectUserId && (!subjectUser || (input.shopId && subjectUser.shopId !== input.shopId))) return false;
  if (input.supplierId && (!supplier || (input.shopId && supplier.shopId !== input.shopId))) return false;
  if (input.assignedToId && !assignedAdmin) return false;
  if ((input.linkedEntityType && !input.linkedEntityId) || (!input.linkedEntityType && input.linkedEntityId)) return false;
  return true;
}

async function createCaseWithUniqueReference(data: Omit<Prisma.SupportCaseUncheckedCreateInput, "reference">) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await platformDb.supportCase.create({ data: { ...data, reference: createSupportCaseReference() } });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002" || attempt === 3) throw error;
    }
  }
  throw new Error("Unable to create a unique support case reference.");
}

export async function createSupportCaseAction(formData: FormData) {
  const session = await requirePlatformPermission("support");
  const parsed = createCaseSchema.safeParse({
    shopId: formData.get("shopId"),
    subjectUserId: formData.get("subjectUserId"),
    supplierId: formData.get("supplierId"),
    assignedToId: formData.get("assignedToId"),
    category: formData.get("category"),
    priority: formData.get("priority"),
    title: formData.get("title"),
    summary: formData.get("summary"),
    linkedEntityType: formData.get("linkedEntityType"),
    linkedEntityId: formData.get("linkedEntityId"),
  });
  if (!parsed.success || !(await validateCaseReferences(parsed.data))) redirect("/admin/support/cases/new?error=invalid");

  const supportCase = await createCaseWithUniqueReference({
    ...parsed.data,
    openedById: session.id,
    status: SupportCaseStatus.OPEN,
  });
  await audit({
    shopId: supportCase.shopId,
    userId: session.id,
    action: "admin.support_case_created",
    entityType: "SupportCase",
    entityId: supportCase.id,
    metadata: { reference: supportCase.reference, category: supportCase.category, priority: supportCase.priority },
  });
  revalidatePath("/admin/support");
  revalidatePath("/admin/support/cases");
  redirect(`/admin/support/cases/${supportCase.id}?created=true`);
}

export async function addSupportCaseNoteAction(formData: FormData) {
  const session = await requirePlatformPermission("support");
  const parsed = noteSchema.safeParse({ caseId: formData.get("caseId"), body: formData.get("body"), isInternal: formData.get("isInternal") });
  if (!parsed.success) redirect(`/admin/support/cases/${String(formData.get("caseId") ?? "")}?error=note`);

  const supportCase = await platformDb.supportCase.findUnique({ where: { id: parsed.data.caseId }, select: { id: true, shopId: true, reference: true } });
  if (!supportCase) redirect("/admin/support/cases?error=missing");
  const note = await platformDb.supportCaseNote.create({ data: { ...parsed.data, authorId: session.id } });
  await audit({
    shopId: supportCase.shopId,
    userId: session.id,
    action: "admin.support_case_note_added",
    entityType: "SupportCaseNote",
    entityId: note.id,
    metadata: { caseId: supportCase.id, reference: supportCase.reference, isInternal: note.isInternal },
  });
  revalidatePath(`/admin/support/cases/${supportCase.id}`);
}

export async function updateSupportCaseAction(formData: FormData) {
  const session = await requirePlatformPermission("support");
  const parsed = updateCaseSchema.safeParse({
    caseId: formData.get("caseId"),
    expectedUpdatedAt: formData.get("expectedUpdatedAt"),
    assignedToId: formData.get("assignedToId"),
    priority: formData.get("priority"),
    status: formData.get("status"),
    resolution: formData.get("resolution"),
  });
  if (!parsed.success) redirect(`/admin/support/cases/${String(formData.get("caseId") ?? "")}?error=invalid`);

  const existing = await platformDb.supportCase.findUnique({ where: { id: parsed.data.caseId } });
  if (!existing) redirect("/admin/support/cases?error=missing");
  if (parsed.data.assignedToId) {
    const assignee = await platformDb.user.findFirst({ where: { id: parsed.data.assignedToId, role: Role.SUPER_ADMIN, shopId: null, isActive: true }, select: { id: true } });
    if (!assignee) redirect(`/admin/support/cases/${existing.id}?error=assignee`);
  }
  if (parsed.data.status !== existing.status && !allowedTransitions[existing.status].includes(parsed.data.status)) {
    redirect(`/admin/support/cases/${existing.id}?error=transition`);
  }

  const terminal = [SupportCaseStatus.RESOLVED, SupportCaseStatus.CLOSED].includes(parsed.data.status);
  const changed = await platformDb.supportCase.updateMany({
    where: { id: existing.id, updatedAt: parsed.data.expectedUpdatedAt },
    data: {
      assignedToId: parsed.data.assignedToId ?? null,
      priority: parsed.data.priority,
      status: parsed.data.status,
      resolution: parsed.data.resolution ?? (terminal ? existing.resolution : null),
      resolvedAt: terminal ? existing.resolvedAt ?? new Date() : null,
    },
  });
  if (changed.count !== 1) redirect(`/admin/support/cases/${existing.id}?error=changed`);

  await audit({
    shopId: existing.shopId,
    userId: session.id,
    action: "admin.support_case_updated",
    entityType: "SupportCase",
    entityId: existing.id,
    metadata: {
      reference: existing.reference,
      fromStatus: existing.status,
      toStatus: parsed.data.status,
      fromPriority: existing.priority,
      toPriority: parsed.data.priority,
      assignedToId: parsed.data.assignedToId ?? null,
    },
  });
  revalidatePath("/admin/support");
  revalidatePath("/admin/support/cases");
  revalidatePath(`/admin/support/cases/${existing.id}`);
  redirect(`/admin/support/cases/${existing.id}?updated=true`);
}
