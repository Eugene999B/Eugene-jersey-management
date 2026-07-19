import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

type AuditInput = {
  shopId?: string | null;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function audit(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      shopId: input.shopId ?? null,
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? {},
    },
  });
}
