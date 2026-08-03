-- Phase 9 adds a non-destructive workflow layer beside existing orders.
CREATE TABLE "OrderWorkflow" (
  "orderId" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "assignedToId" TEXT,
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "dueAt" TIMESTAMP(3),
  "approvalStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
  "approvalAt" TIMESTAMP(3),
  "approvalNote" TEXT,
  "productionInstructions" TEXT,
  "internalNotes" TEXT,
  "depositTargetAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "balanceDueAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrderWorkflow_pkey" PRIMARY KEY ("orderId"),
  CONSTRAINT "OrderWorkflow_priority_check" CHECK ("priority" IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  CONSTRAINT "OrderWorkflow_approvalStatus_check" CHECK ("approvalStatus" IN ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'CHANGES_REQUESTED')),
  CONSTRAINT "OrderWorkflow_depositTargetAmount_check" CHECK ("depositTargetAmount" >= 0),
  CONSTRAINT "OrderWorkflow_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrderWorkflow_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrderWorkflow_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "OrderWorkflowEvent" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "actorId" TEXT,
  "type" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "note" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrderWorkflowEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderWorkflowEvent_type_check" CHECK ("type" IN (
    'CREATED',
    'STATUS_CHANGED',
    'ASSIGNED',
    'PRIORITY_CHANGED',
    'DUE_DATE_CHANGED',
    'APPROVAL_CHANGED',
    'INSTRUCTIONS_CHANGED',
    'FINANCE_TARGET_CHANGED',
    'NOTE_ADDED',
    'FULFILLMENT_UPDATED',
    'CANCELLED'
  )),
  CONSTRAINT "OrderWorkflowEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrderWorkflowEvent_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrderWorkflowEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "OrderWorkflow_shopId_priority_dueAt_idx" ON "OrderWorkflow"("shopId", "priority", "dueAt");
CREATE INDEX "OrderWorkflow_assignedToId_dueAt_idx" ON "OrderWorkflow"("assignedToId", "dueAt");
CREATE INDEX "OrderWorkflow_approvalStatus_dueAt_idx" ON "OrderWorkflow"("approvalStatus", "dueAt");
CREATE INDEX "OrderWorkflowEvent_orderId_createdAt_idx" ON "OrderWorkflowEvent"("orderId", "createdAt");
CREATE INDEX "OrderWorkflowEvent_shopId_createdAt_idx" ON "OrderWorkflowEvent"("shopId", "createdAt");
CREATE INDEX "OrderWorkflowEvent_actorId_createdAt_idx" ON "OrderWorkflowEvent"("actorId", "createdAt");

INSERT INTO "OrderWorkflow" ("orderId", "shopId", "priority", "approvalStatus", "createdAt", "updatedAt")
SELECT "id", "shopId", CASE WHEN "rush" THEN 'URGENT' ELSE 'NORMAL' END, 'NOT_REQUIRED', "createdAt", "updatedAt"
FROM "Order"
ON CONFLICT ("orderId") DO NOTHING;

INSERT INTO "OrderWorkflowEvent" ("id", "shopId", "orderId", "type", "toStatus", "metadata", "createdAt")
SELECT 'phase9-created-' || "id", "shopId", "id", 'CREATED', "status"::TEXT, jsonb_build_object('source', 'phase9-backfill'), "createdAt"
FROM "Order"
ON CONFLICT ("id") DO NOTHING;
