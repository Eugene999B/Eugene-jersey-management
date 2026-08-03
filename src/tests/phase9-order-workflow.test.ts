import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ORDER_APPROVAL_STATUSES,
  ORDER_WORKFLOW_EVENT_TYPES,
  ORDER_WORKFLOW_PRIORITIES,
} from "@/lib/order-workflow";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("Phase 9 order and job workflow", () => {
  it("defines general-business priorities, approvals and immutable event types", () => {
    expect(ORDER_WORKFLOW_PRIORITIES).toEqual(["LOW", "NORMAL", "HIGH", "URGENT"]);
    expect(ORDER_APPROVAL_STATUSES).toEqual(["NOT_REQUIRED", "PENDING", "APPROVED", "CHANGES_REQUESTED"]);
    expect(ORDER_WORKFLOW_EVENT_TYPES).toContain("STATUS_CHANGED");
    expect(ORDER_WORKFLOW_EVENT_TYPES).toContain("FULFILLMENT_UPDATED");
    expect(new Set(ORDER_WORKFLOW_EVENT_TYPES).size).toBe(ORDER_WORKFLOW_EVENT_TYPES.length);
  });

  it("uses an additive migration and backfills existing orders safely", () => {
    const migration = source("../../prisma/migrations/20260803181500_phase9_order_job_workflow/migration.sql");
    expect(migration).toContain('CREATE TABLE "OrderWorkflow"');
    expect(migration).toContain('CREATE TABLE "OrderWorkflowEvent"');
    expect(migration).toContain('INSERT INTO "OrderWorkflow"');
    expect(migration).toContain('FROM "Order"');
    expect(migration).toContain('ON CONFLICT ("orderId") DO NOTHING');
    expect(migration).not.toContain('DROP TABLE "Order"');
    expect(migration).not.toContain('DELETE FROM "Order"');
    expect(migration).not.toContain('UPDATE "Payment"');
  });

  it("scopes every unrestricted workflow query by shop and order", () => {
    const service = source("../lib/order-workflow.ts");
    expect(service).toContain('WHERE "id" = ${orderId} AND "shopId" = ${shopId}');
    expect(service).toContain('workflow."orderId" = ${orderId} AND workflow."shopId" = ${shopId}');
    expect(service).toContain('event."shopId" = ${shopId} AND event."orderId" = ${orderId}');
    expect(service).toContain('shopId: input.shopId');
    expect(service).toContain('role: { notIn: [Role.SUPER_ADMIN, Role.SUPPLIER] }');
  });

  it("blocks approval-controlled production and records status and fulfilment events", () => {
    const statusRoute = source("../app/api/orders/[orderId]/status/route.ts");
    const pickupRoute = source("../app/api/orders/[orderId]/verify-pickup/route.ts");
    const deliveryAction = source("../app/track/[orderId]/actions.ts");

    expect(statusRoute).toContain('workflow.approvalStatus');
    expect(statusRoute).toContain('Customer approval is required before production can start.');
    expect(statusRoute).toContain('recordOrderWorkflowEvent');
    expect(pickupRoute).toContain('type: "FULFILLMENT_UPDATED"');
    expect(deliveryAction).toContain('type: "FULFILLMENT_UPDATED"');
  });

  it("provides one unified control room while keeping customer tracking private", () => {
    const detail = source("../app/dashboard/orders/[orderId]/page.tsx");
    const board = source("../components/orders/order-board.tsx");
    const tracker = source("../app/track/[orderId]/page.tsx");

    expect(detail).toContain("Order and job control room");
    expect(detail).toContain("Payment and debt history");
    expect(detail).toContain("Workflow timeline");
    expect(board).toContain("Open workflow");
    expect(board).toContain("assignedToName");
    expect(board).toContain("approvalStatus");
    expect(tracker).toContain("Expected date");
    expect(tracker).toContain("Order updates");
    expect(tracker).not.toContain("internalNotes");
    expect(tracker).not.toContain("assignedToName");
    expect(tracker).not.toContain("productionInstructions");
  });

  it("keeps role-specific workflow changes controlled", () => {
    const route = source("../app/api/orders/[orderId]/workflow/route.ts");
    expect(route).toContain("Only owners and managers can assign order responsibility.");
    expect(route).toContain("Accountants can update finance targets and internal finance notes only.");
    expect(route).toContain("Deposit target cannot exceed the order total.");
    expect(route).toContain('rush: body.priority === "URGENT"');
  });
});
