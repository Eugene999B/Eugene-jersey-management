import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import {
  ORDER_APPROVAL_STATUSES,
  ORDER_WORKFLOW_PRIORITIES,
  updateOrderWorkflow,
  type OrderWorkflowPriority,
  type OrderApprovalStatus,
} from "@/lib/order-workflow";
import { isTrustedApplicationOrigin } from "@/lib/request-origin";

const workflowRoles = [Role.OWNER, Role.MANAGER, Role.CASHIER, Role.DESIGNER, Role.ACCOUNTANT];
const financeRoles = [Role.OWNER, Role.MANAGER, Role.CASHIER, Role.ACCOUNTANT];
const assignmentRoles = [Role.OWNER, Role.MANAGER];

const schema = z.object({
  assignedToId: z.string().min(1).nullable().optional(),
  priority: z.enum(ORDER_WORKFLOW_PRIORITIES).optional(),
  dueAt: z.coerce.date().nullable().optional(),
  approvalStatus: z.enum(ORDER_APPROVAL_STATUSES).optional(),
  approvalNote: z.string().max(1200).nullable().optional(),
  productionInstructions: z.string().max(5000).nullable().optional(),
  internalNotes: z.string().max(5000).nullable().optional(),
  depositTargetAmount: z.coerce.number().min(0).max(100_000_000).optional(),
  balanceDueAt: z.coerce.date().nullable().optional(),
  note: z.string().trim().max(800).nullable().optional(),
}).refine((value) => Object.keys(value).some((key) => key !== "note"), {
  message: "At least one workflow field is required.",
});

type RouteContext = { params: Promise<{ orderId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await requireRole(workflowRoles);
  if (!session.shopId) return NextResponse.json({ error: "Missing shop context." }, { status: 403 });
  if (!isTrustedApplicationOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });

  const { orderId } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid order workflow payload." }, { status: 400 });

  const order = await prisma.order.findFirst({
    where: { id: orderId, shopId: session.shopId },
    select: { id: true, totalAmount: true, status: true, receiptNumber: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const body = parsed.data;
  if (body.assignedToId !== undefined && !assignmentRoles.includes(session.role)) {
    return NextResponse.json({ error: "Only owners and managers can assign order responsibility." }, { status: 403 });
  }
  if ((body.depositTargetAmount !== undefined || body.balanceDueAt !== undefined) && !financeRoles.includes(session.role)) {
    return NextResponse.json({ error: "You do not have permission to change order finance targets." }, { status: 403 });
  }
  if (body.depositTargetAmount !== undefined && body.depositTargetAmount > Number(order.totalAmount)) {
    return NextResponse.json({ error: "Deposit target cannot exceed the order total." }, { status: 400 });
  }
  if (session.role === Role.ACCOUNTANT && (
    body.assignedToId !== undefined
    || body.priority !== undefined
    || body.dueAt !== undefined
    || body.approvalStatus !== undefined
    || body.approvalNote !== undefined
    || body.productionInstructions !== undefined
  )) {
    return NextResponse.json({ error: "Accountants can update finance targets and internal finance notes only." }, { status: 403 });
  }

  try {
    const workflow = await updateOrderWorkflow({
      shopId: session.shopId,
      orderId,
      actorId: session.id,
      note: body.note,
      mutation: {
        assignedToId: body.assignedToId,
        priority: body.priority as OrderWorkflowPriority | undefined,
        dueAt: body.dueAt,
        approvalStatus: body.approvalStatus as OrderApprovalStatus | undefined,
        approvalNote: body.approvalNote,
        productionInstructions: body.productionInstructions,
        internalNotes: body.internalNotes,
        depositTargetAmount: body.depositTargetAmount,
        balanceDueAt: body.balanceDueAt,
      },
    });

    if (body.priority !== undefined) {
      await prisma.order.updateMany({
        where: { id: orderId, shopId: session.shopId },
        data: { rush: body.priority === "URGENT" },
      });
    }

    await audit({
      shopId: session.shopId,
      userId: session.id,
      action: "orders.workflow_updated",
      entityType: "Order",
      entityId: orderId,
      metadata: {
        receiptNumber: order.receiptNumber,
        changedFields: Object.keys(body).filter((key) => key !== "note"),
      },
    });

    return NextResponse.json({ ok: true, workflow });
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_WORKFLOW_ASSIGNEE_INVALID") {
      return NextResponse.json({ error: "The selected assignee is not an active staff member of this business." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "ORDER_WORKFLOW_NOT_FOUND") {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
    throw error;
  }
}
