import { nanoid } from "nanoid";
import { Prisma, Role } from "@prisma/client";
import { platformDb } from "@/lib/platform-db";

export const ORDER_WORKFLOW_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export const ORDER_APPROVAL_STATUSES = ["NOT_REQUIRED", "PENDING", "APPROVED", "CHANGES_REQUESTED"] as const;
export const ORDER_WORKFLOW_EVENT_TYPES = [
  "CREATED",
  "STATUS_CHANGED",
  "ASSIGNED",
  "PRIORITY_CHANGED",
  "DUE_DATE_CHANGED",
  "APPROVAL_CHANGED",
  "INSTRUCTIONS_CHANGED",
  "FINANCE_TARGET_CHANGED",
  "NOTE_ADDED",
  "FULFILLMENT_UPDATED",
  "CANCELLED",
] as const;

export type OrderWorkflowPriority = (typeof ORDER_WORKFLOW_PRIORITIES)[number];
export type OrderApprovalStatus = (typeof ORDER_APPROVAL_STATUSES)[number];
export type OrderWorkflowEventType = (typeof ORDER_WORKFLOW_EVENT_TYPES)[number];

export type OrderWorkflowRecord = {
  orderId: string;
  shopId: string;
  assignedToId: string | null;
  assignedToName: string | null;
  assignedToRole: Role | null;
  priority: OrderWorkflowPriority;
  dueAt: Date | null;
  approvalStatus: OrderApprovalStatus;
  approvalAt: Date | null;
  approvalNote: string | null;
  productionInstructions: string | null;
  internalNotes: string | null;
  depositTargetAmount: number;
  balanceDueAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OrderWorkflowEventRecord = {
  id: string;
  shopId: string;
  orderId: string;
  actorId: string | null;
  actorName: string | null;
  type: OrderWorkflowEventType;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

type WorkflowRow = Omit<OrderWorkflowRecord, "depositTargetAmount"> & {
  depositTargetAmount: Prisma.Decimal;
};

type EventRow = Omit<OrderWorkflowEventRecord, "metadata"> & {
  metadata: Prisma.JsonValue;
};

type TransactionClient = Parameters<Parameters<typeof platformDb.$transaction>[0]>[0];

type WorkflowMutation = {
  assignedToId?: string | null;
  priority?: OrderWorkflowPriority;
  dueAt?: Date | null;
  approvalStatus?: OrderApprovalStatus;
  approvalNote?: string | null;
  productionInstructions?: string | null;
  internalNotes?: string | null;
  depositTargetAmount?: number;
  balanceDueAt?: Date | null;
};

type EventInput = {
  shopId: string;
  orderId: string;
  actorId?: string | null;
  type: OrderWorkflowEventType;
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
};

function cleanText(value: string | null | undefined, max: number) {
  if (value == null) return null;
  const cleaned = value.trim().slice(0, max);
  return cleaned || null;
}

function workflowFromRow(row: WorkflowRow): OrderWorkflowRecord {
  return {
    ...row,
    depositTargetAmount: Number(row.depositTargetAmount),
  };
}

function eventFromRow(row: EventRow): OrderWorkflowEventRecord {
  const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
    ? row.metadata as Record<string, unknown>
    : {};
  return { ...row, metadata };
}

async function ensureWorkflow(tx: TransactionClient, shopId: string, orderId: string) {
  const inserted = await tx.$executeRaw`
    INSERT INTO "OrderWorkflow" ("orderId", "shopId", "priority", "approvalStatus", "createdAt", "updatedAt")
    SELECT "id", "shopId", CASE WHEN "rush" THEN 'URGENT' ELSE 'NORMAL' END, 'NOT_REQUIRED', "createdAt", NOW()
    FROM "Order"
    WHERE "id" = ${orderId} AND "shopId" = ${shopId}
    ON CONFLICT ("orderId") DO NOTHING
  `;
  const rows = await tx.$queryRaw<Array<{ orderId: string }>>`
    SELECT "orderId"
    FROM "OrderWorkflow"
    WHERE "orderId" = ${orderId} AND "shopId" = ${shopId}
    LIMIT 1
  `;
  if (!rows.length) throw new Error("ORDER_WORKFLOW_NOT_FOUND");
  return inserted;
}

async function fetchWorkflow(tx: TransactionClient, shopId: string, orderId: string) {
  const rows = await tx.$queryRaw<WorkflowRow[]>`
    SELECT
      workflow."orderId",
      workflow."shopId",
      workflow."assignedToId",
      assignee."name" AS "assignedToName",
      assignee."role" AS "assignedToRole",
      workflow."priority",
      workflow."dueAt",
      workflow."approvalStatus",
      workflow."approvalAt",
      workflow."approvalNote",
      workflow."productionInstructions",
      workflow."internalNotes",
      workflow."depositTargetAmount",
      workflow."balanceDueAt",
      workflow."createdAt",
      workflow."updatedAt"
    FROM "OrderWorkflow" workflow
    LEFT JOIN "User" assignee
      ON assignee."id" = workflow."assignedToId" AND assignee."shopId" = workflow."shopId"
    WHERE workflow."orderId" = ${orderId} AND workflow."shopId" = ${shopId}
    LIMIT 1
  `;
  return rows[0] ? workflowFromRow(rows[0]) : null;
}

async function insertEvent(tx: TransactionClient, input: EventInput) {
  await tx.$executeRaw`
    INSERT INTO "OrderWorkflowEvent" (
      "id", "shopId", "orderId", "actorId", "type", "fromStatus", "toStatus", "note", "metadata", "createdAt"
    )
    SELECT
      ${nanoid()},
      ${input.shopId},
      ${input.orderId},
      ${input.actorId ?? null},
      ${input.type},
      ${input.fromStatus ?? null},
      ${input.toStatus ?? null},
      ${cleanText(input.note, 800)},
      ${JSON.stringify(input.metadata ?? {})}::jsonb,
      NOW()
    WHERE EXISTS (
      SELECT 1 FROM "Order" WHERE "id" = ${input.orderId} AND "shopId" = ${input.shopId}
    )
  `;
}

export async function getOrderWorkflow(shopId: string, orderId: string) {
  return platformDb.$transaction(async (tx) => {
    await ensureWorkflow(tx, shopId, orderId);
    return fetchWorkflow(tx, shopId, orderId);
  });
}

export async function listOrderWorkflows(shopId: string, orderIds: readonly string[]) {
  if (!orderIds.length) return new Map<string, OrderWorkflowRecord>();
  const uniqueIds = [...new Set(orderIds)];
  await platformDb.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "OrderWorkflow" ("orderId", "shopId", "priority", "approvalStatus", "createdAt", "updatedAt")
      SELECT "id", "shopId", CASE WHEN "rush" THEN 'URGENT' ELSE 'NORMAL' END, 'NOT_REQUIRED', "createdAt", NOW()
      FROM "Order"
      WHERE "shopId" = ${shopId} AND "id" IN (${Prisma.join(uniqueIds)})
      ON CONFLICT ("orderId") DO NOTHING
    `;
  });

  const rows = await platformDb.$queryRaw<WorkflowRow[]>`
    SELECT
      workflow."orderId",
      workflow."shopId",
      workflow."assignedToId",
      assignee."name" AS "assignedToName",
      assignee."role" AS "assignedToRole",
      workflow."priority",
      workflow."dueAt",
      workflow."approvalStatus",
      workflow."approvalAt",
      workflow."approvalNote",
      workflow."productionInstructions",
      workflow."internalNotes",
      workflow."depositTargetAmount",
      workflow."balanceDueAt",
      workflow."createdAt",
      workflow."updatedAt"
    FROM "OrderWorkflow" workflow
    LEFT JOIN "User" assignee
      ON assignee."id" = workflow."assignedToId" AND assignee."shopId" = workflow."shopId"
    WHERE workflow."shopId" = ${shopId} AND workflow."orderId" IN (${Prisma.join(uniqueIds)})
  `;
  return new Map(rows.map((row) => [row.orderId, workflowFromRow(row)]));
}

export async function listOrderWorkflowEvents(shopId: string, orderId: string, limit = 80) {
  const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
  const rows = await platformDb.$queryRaw<EventRow[]>`
    SELECT
      event."id",
      event."shopId",
      event."orderId",
      event."actorId",
      actor."name" AS "actorName",
      event."type",
      event."fromStatus",
      event."toStatus",
      event."note",
      event."metadata",
      event."createdAt"
    FROM "OrderWorkflowEvent" event
    LEFT JOIN "User" actor
      ON actor."id" = event."actorId" AND actor."shopId" = event."shopId"
    WHERE event."shopId" = ${shopId} AND event."orderId" = ${orderId}
    ORDER BY event."createdAt" DESC
    LIMIT ${safeLimit}
  `;
  return rows.map(eventFromRow);
}

export async function updateOrderWorkflow(input: {
  shopId: string;
  orderId: string;
  actorId: string;
  mutation: WorkflowMutation;
  note?: string | null;
}) {
  return platformDb.$transaction(async (tx) => {
    await ensureWorkflow(tx, input.shopId, input.orderId);
    const current = await fetchWorkflow(tx, input.shopId, input.orderId);
    if (!current) throw new Error("ORDER_WORKFLOW_NOT_FOUND");

    const assignedToId = input.mutation.assignedToId === undefined ? current.assignedToId : input.mutation.assignedToId;
    if (assignedToId) {
      const assignee = await tx.user.findFirst({
        where: {
          id: assignedToId,
          shopId: input.shopId,
          isActive: true,
          role: { notIn: [Role.SUPER_ADMIN, Role.SUPPLIER] },
        },
        select: { id: true },
      });
      if (!assignee) throw new Error("ORDER_WORKFLOW_ASSIGNEE_INVALID");
    }

    const priority = input.mutation.priority ?? current.priority;
    const dueAt = input.mutation.dueAt === undefined ? current.dueAt : input.mutation.dueAt;
    const approvalStatus = input.mutation.approvalStatus ?? current.approvalStatus;
    const approvalNote = input.mutation.approvalNote === undefined
      ? current.approvalNote
      : cleanText(input.mutation.approvalNote, 1200);
    const productionInstructions = input.mutation.productionInstructions === undefined
      ? current.productionInstructions
      : cleanText(input.mutation.productionInstructions, 5000);
    const internalNotes = input.mutation.internalNotes === undefined
      ? current.internalNotes
      : cleanText(input.mutation.internalNotes, 5000);
    const depositTargetAmount = input.mutation.depositTargetAmount === undefined
      ? current.depositTargetAmount
      : Math.max(0, Number(input.mutation.depositTargetAmount.toFixed(2)));
    const balanceDueAt = input.mutation.balanceDueAt === undefined ? current.balanceDueAt : input.mutation.balanceDueAt;
    const approvalAt = approvalStatus === "APPROVED"
      ? current.approvalStatus === "APPROVED" ? current.approvalAt ?? new Date() : new Date()
      : null;

    await tx.$executeRaw`
      UPDATE "OrderWorkflow"
      SET
        "assignedToId" = ${assignedToId},
        "priority" = ${priority},
        "dueAt" = ${dueAt},
        "approvalStatus" = ${approvalStatus},
        "approvalAt" = ${approvalAt},
        "approvalNote" = ${approvalNote},
        "productionInstructions" = ${productionInstructions},
        "internalNotes" = ${internalNotes},
        "depositTargetAmount" = ${depositTargetAmount},
        "balanceDueAt" = ${balanceDueAt},
        "updatedAt" = NOW()
      WHERE "orderId" = ${input.orderId} AND "shopId" = ${input.shopId}
    `;

    const changes: Array<{ type: OrderWorkflowEventType; metadata: Record<string, unknown>; note?: string | null }> = [];
    if (assignedToId !== current.assignedToId) changes.push({ type: "ASSIGNED", metadata: { from: current.assignedToId, to: assignedToId } });
    if (priority !== current.priority) changes.push({ type: "PRIORITY_CHANGED", metadata: { from: current.priority, to: priority } });
    if ((dueAt?.toISOString() ?? null) !== (current.dueAt?.toISOString() ?? null)) changes.push({ type: "DUE_DATE_CHANGED", metadata: { from: current.dueAt, to: dueAt } });
    if (approvalStatus !== current.approvalStatus || approvalNote !== current.approvalNote) changes.push({ type: "APPROVAL_CHANGED", metadata: { from: current.approvalStatus, to: approvalStatus }, note: approvalNote });
    if (productionInstructions !== current.productionInstructions) changes.push({ type: "INSTRUCTIONS_CHANGED", metadata: { field: "productionInstructions" } });
    if (internalNotes !== current.internalNotes) changes.push({ type: "NOTE_ADDED", metadata: { field: "internalNotes" }, note: input.note ?? "Internal workflow notes updated." });
    if (depositTargetAmount !== current.depositTargetAmount || (balanceDueAt?.toISOString() ?? null) !== (current.balanceDueAt?.toISOString() ?? null)) {
      changes.push({ type: "FINANCE_TARGET_CHANGED", metadata: { depositTargetAmount, balanceDueAt } });
    }
    if (!changes.length && input.note) changes.push({ type: "NOTE_ADDED", metadata: { field: "timeline" }, note: input.note });

    for (const change of changes) {
      await insertEvent(tx, {
        shopId: input.shopId,
        orderId: input.orderId,
        actorId: input.actorId,
        type: change.type,
        note: change.note ?? input.note,
        metadata: change.metadata,
      });
    }

    return fetchWorkflow(tx, input.shopId, input.orderId);
  });
}

export async function recordOrderWorkflowEvent(input: EventInput) {
  return platformDb.$transaction(async (tx) => {
    await ensureWorkflow(tx, input.shopId, input.orderId);
    await insertEvent(tx, input);
  });
}
