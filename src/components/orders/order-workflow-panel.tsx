"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CheckCircle2, Save, UserRoundCheck } from "lucide-react";
import { OrderStatus, Role } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { currency, titleCase } from "@/lib/format";
import {
  ORDER_APPROVAL_STATUSES,
  ORDER_WORKFLOW_PRIORITIES,
  type OrderApprovalStatus,
  type OrderWorkflowPriority,
} from "@/lib/order-workflow";

type WorkflowView = {
  assignedToId: string | null;
  assignedToName: string | null;
  priority: OrderWorkflowPriority;
  dueAt: string | null;
  approvalStatus: OrderApprovalStatus;
  approvalAt: string | null;
  approvalNote: string | null;
  productionInstructions: string | null;
  internalNotes: string | null;
  depositTargetAmount: number;
  balanceDueAt: string | null;
};

type StaffOption = {
  id: string;
  name: string;
  role: Role;
  staffTitle: string | null;
};

type Props = {
  orderId: string;
  receiptNumber: string;
  role: Role;
  status: OrderStatus;
  orderTotal: number;
  paidAmount: number;
  currencyCode: string;
  workflow: WorkflowView;
  staff: StaffOption[];
};

const transitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.IN_PRODUCTION, OrderStatus.CANCELLED],
  IN_PRODUCTION: [OrderStatus.READY, OrderStatus.CANCELLED],
  READY: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

function dateInput(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function allowedTransitions(status: OrderStatus, role: Role) {
  if (role === Role.DESIGNER) {
    if (status === OrderStatus.PENDING) return [OrderStatus.IN_PRODUCTION];
    if (status === OrderStatus.IN_PRODUCTION) return [OrderStatus.READY];
    return [];
  }
  if (![Role.OWNER, Role.MANAGER, Role.CASHIER].includes(role)) return [];
  return transitions[status];
}

export function OrderWorkflowPanel({
  orderId,
  receiptNumber,
  role,
  status: initialStatus,
  orderTotal,
  paidAmount,
  currencyCode,
  workflow,
  staff,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(initialStatus);
  const [assignedToId, setAssignedToId] = useState(workflow.assignedToId ?? "");
  const [priority, setPriority] = useState<OrderWorkflowPriority>(workflow.priority);
  const [dueAt, setDueAt] = useState(dateInput(workflow.dueAt));
  const [approvalStatus, setApprovalStatus] = useState<OrderApprovalStatus>(workflow.approvalStatus);
  const [approvalNote, setApprovalNote] = useState(workflow.approvalNote ?? "");
  const [productionInstructions, setProductionInstructions] = useState(workflow.productionInstructions ?? "");
  const [internalNotes, setInternalNotes] = useState(workflow.internalNotes ?? "");
  const [depositTargetAmount, setDepositTargetAmount] = useState(workflow.depositTargetAmount.toFixed(2));
  const [balanceDueAt, setBalanceDueAt] = useState(dateInput(workflow.balanceDueAt));
  const [timelineNote, setTimelineNote] = useState("");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const canAssign = [Role.OWNER, Role.MANAGER].includes(role);
  const canFinance = [Role.OWNER, Role.MANAGER, Role.CASHIER, Role.ACCOUNTANT].includes(role);
  const canProduction = [Role.OWNER, Role.MANAGER, Role.CASHIER, Role.DESIGNER].includes(role);
  const balance = Math.max(orderTotal - paidAmount, 0);
  const depositTarget = Number(depositTargetAmount || 0);
  const depositMet = paidAmount + 0.005 >= depositTarget;
  const nextStages = useMemo(() => allowedTransitions(status, role), [role, status]);

  function saveWorkflow() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/orders/${orderId}/workflow`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(canAssign ? { assignedToId: assignedToId || null } : {}),
          ...(canProduction ? {
            priority,
            dueAt: dueAt ? new Date(`${dueAt}T12:00:00`).toISOString() : null,
            approvalStatus,
            approvalNote: approvalNote || null,
            productionInstructions: productionInstructions || null,
          } : {}),
          internalNotes: internalNotes || null,
          ...(canFinance ? {
            depositTargetAmount: Number(depositTargetAmount || 0),
            balanceDueAt: balanceDueAt ? new Date(`${balanceDueAt}T12:00:00`).toISOString() : null,
          } : {}),
          note: timelineNote || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage({ tone: "error", text: payload.error ?? "Could not save order workflow." });
        return;
      }
      setTimelineNote("");
      setMessage({ tone: "success", text: `Workflow for ${receiptNumber} saved.` });
      router.refresh();
    });
  }

  function changeStatus(nextStatus: OrderStatus) {
    const cancellation = nextStatus === OrderStatus.CANCELLED;
    if (cancellation && !window.confirm(`Cancel ${receiptNumber}? Paid online orders must use the refund or return workflow.`)) return;
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, note: timelineNote || undefined }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage({ tone: "error", text: payload.error ?? "Could not update order stage." });
        return;
      }
      setStatus(nextStatus);
      setTimelineNote("");
      setMessage({ tone: "success", text: `${receiptNumber} moved to ${titleCase(nextStatus)}.` });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} className={`rounded-xl border p-3 text-sm font-semibold ${message.tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          {message.text}
        </p>
      ) : null}

      <section className="panel p-4 sm:p-5" aria-labelledby="order-stage-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="order-stage-heading" className="font-bold text-slate-950">Order stage</h2>
            <p className="mt-1 text-sm text-slate-600">Move work forward only after the required approval, payment, and fulfilment checks.</p>
          </div>
          <Badge tone={status === OrderStatus.COMPLETED ? "green" : status === OrderStatus.CANCELLED ? "red" : "blue"}>{titleCase(status)}</Badge>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {nextStages.map((nextStatus) => (
            <Button key={nextStatus} variant={nextStatus === OrderStatus.CANCELLED ? "danger" : "outline"} disabled={isPending} onClick={() => changeStatus(nextStatus)}>
              {nextStatus === OrderStatus.COMPLETED ? <CheckCircle2 size={16} /> : null}
              Move to {titleCase(nextStatus)}
            </Button>
          ))}
          {!nextStages.length ? <p className="text-sm text-slate-500">No further stage action is available for your role.</p> : null}
        </div>
      </section>

      <section className="panel p-4 sm:p-5" aria-labelledby="responsibility-heading">
        <div className="flex items-center gap-2">
          <UserRoundCheck size={18} className="text-cyan-700" />
          <h2 id="responsibility-heading" className="font-bold text-slate-950">Responsibility and deadline</h2>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block text-sm font-semibold text-slate-700">
            Assigned staff
            <select className="field mt-1" value={assignedToId} disabled={!canAssign} onChange={(event) => setAssignedToId(event.target.value)}>
              <option value="">Unassigned</option>
              {staff.map((member) => <option key={member.id} value={member.id}>{member.name} — {member.staffTitle || titleCase(member.role)}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Priority
            <select className="field mt-1" value={priority} disabled={!canProduction} onChange={(event) => setPriority(event.target.value as OrderWorkflowPriority)}>
              {ORDER_WORKFLOW_PRIORITIES.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Due date
            <input className="field mt-1" type="date" value={dueAt} disabled={!canProduction} onChange={(event) => setDueAt(event.target.value)} />
          </label>
        </div>
        {!canAssign ? <p className="mt-2 text-xs text-slate-500">Only an owner or manager can change the assigned staff member.</p> : null}
      </section>

      <section className="panel p-4 sm:p-5" aria-labelledby="approval-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="approval-heading" className="font-bold text-slate-950">Customer approval</h2>
            <p className="mt-1 text-sm text-slate-600">Production is blocked while approval is pending or changes are requested.</p>
          </div>
          {workflow.approvalAt ? <Badge tone="green">Approved previously</Badge> : null}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[220px_1fr]">
          <label className="block text-sm font-semibold text-slate-700">
            Approval status
            <select className="field mt-1" value={approvalStatus} disabled={!canProduction} onChange={(event) => setApprovalStatus(event.target.value as OrderApprovalStatus)}>
              {ORDER_APPROVAL_STATUSES.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Approval evidence or requested changes
            <textarea className="field mt-1 min-h-24" value={approvalNote} disabled={!canProduction} onChange={(event) => setApprovalNote(event.target.value)} placeholder="Who approved, how approval was received, or what must change" />
          </label>
        </div>
      </section>

      <section className="panel p-4 sm:p-5" aria-labelledby="instructions-heading">
        <h2 id="instructions-heading" className="font-bold text-slate-950">Work instructions</h2>
        <p className="mt-1 text-sm text-slate-600">Keep production, service, rental preparation, or fulfilment instructions attached to the order.</p>
        <textarea className="field mt-4 min-h-32" value={productionInstructions} disabled={!canProduction} onChange={(event) => setProductionInstructions(event.target.value)} placeholder="Exact work instructions, quality checks, measurements, placement, service steps, or preparation notes" />
      </section>

      <section className="panel p-4 sm:p-5" aria-labelledby="finance-target-heading">
        <div className="flex items-center gap-2">
          <CalendarClock size={18} className="text-cyan-700" />
          <h2 id="finance-target-heading" className="font-bold text-slate-950">Deposit and balance target</h2>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-100 p-3"><p className="text-xs font-bold uppercase text-slate-500">Order total</p><p className="mt-1 font-black">{currency(orderTotal, currencyCode)}</p></div>
          <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs font-bold uppercase text-emerald-700">Paid now</p><p className="mt-1 font-black text-emerald-950">{currency(paidAmount, currencyCode)}</p></div>
          <div className="rounded-xl bg-orange-50 p-3"><p className="text-xs font-bold uppercase text-orange-700">Balance</p><p className="mt-1 font-black text-orange-950">{currency(balance, currencyCode)}</p></div>
          <div className={`rounded-xl p-3 ${depositMet ? "bg-emerald-50" : "bg-red-50"}`}><p className="text-xs font-bold uppercase text-slate-600">Deposit target</p><p className="mt-1 font-black">{currency(depositTarget, currencyCode)}</p><p className="mt-1 text-xs font-semibold">{depositMet ? "Target met" : "Target not met"}</p></div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700">Deposit target<input className="field mt-1" type="number" min="0" max={orderTotal} step="0.01" value={depositTargetAmount} disabled={!canFinance} onChange={(event) => setDepositTargetAmount(event.target.value)} /></label>
          <label className="block text-sm font-semibold text-slate-700">Balance due date<input className="field mt-1" type="date" value={balanceDueAt} disabled={!canFinance} onChange={(event) => setBalanceDueAt(event.target.value)} /></label>
        </div>
      </section>

      <section className="panel p-4 sm:p-5" aria-labelledby="internal-note-heading">
        <h2 id="internal-note-heading" className="font-bold text-slate-950">Internal notes and timeline note</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700">Current internal notes<textarea className="field mt-1 min-h-28" value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} placeholder="Private staff notes" /></label>
          <label className="block text-sm font-semibold text-slate-700">Note for this update<textarea className="field mt-1 min-h-28" value={timelineNote} onChange={(event) => setTimelineNote(event.target.value)} placeholder="Reason, decision, handoff, or customer conversation" /></label>
        </div>
        <div className="mt-4 flex justify-end"><Button disabled={isPending} onClick={saveWorkflow}><Save size={16} />{isPending ? "Saving…" : "Save workflow"}</Button></div>
      </section>
    </div>
  );
}
