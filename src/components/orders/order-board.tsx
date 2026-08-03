"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, CircleDollarSign, UserRound } from "lucide-react";
import { OrderStatus, Role } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { currency, shortDate, titleCase } from "@/lib/format";
import type { OrderApprovalStatus, OrderWorkflowPriority } from "@/lib/order-workflow";

type BoardOrder = {
  id: string;
  receiptNumber: string;
  customerName: string;
  status: OrderStatus;
  rush: boolean;
  priority: OrderWorkflowPriority;
  dueAt: string | null;
  approvalStatus: OrderApprovalStatus;
  assignedToName: string | null;
  fulfillmentType: "PICKUP" | "DELIVERY";
  fulfillmentVerified: boolean;
  hasPendingCash: boolean;
  hasPendingOnlinePayment: boolean;
  totalAmount: number;
  paidAmount: number;
  items: {
    name: string;
    sku: string;
    quantity: number;
    personalizationData: Record<string, unknown> | null;
  }[];
};

const columns: OrderStatus[] = ["PENDING", "IN_PRODUCTION", "READY", "COMPLETED", "CANCELLED"];

function nextStatuses(status: OrderStatus, role: Role) {
  if (role === "DESIGNER") {
    if (status === "PENDING") return ["IN_PRODUCTION"] as OrderStatus[];
    if (status === "IN_PRODUCTION") return ["READY"] as OrderStatus[];
    return [];
  }

  if (!(["OWNER", "MANAGER", "CASHIER"] as Role[]).includes(role)) return [];

  if (status === "PENDING") return ["IN_PRODUCTION", "CANCELLED"] as OrderStatus[];
  if (status === "IN_PRODUCTION") return ["READY", "CANCELLED"] as OrderStatus[];
  if (status === "READY") return ["COMPLETED", "CANCELLED"] as OrderStatus[];
  return [];
}

function priorityTone(priority: OrderWorkflowPriority) {
  if (priority === "URGENT") return "red" as const;
  if (priority === "HIGH") return "orange" as const;
  if (priority === "LOW") return "slate" as const;
  return "blue" as const;
}

export function OrderBoard({ orders, role, currencyCode }: { orders: BoardOrder[]; role: Role; currencyCode: string }) {
  const [localOrders, setLocalOrders] = useState(orders);
  const [activeColumn, setActiveColumn] = useState<OrderStatus>(() => columns.find((column) => orders.some((order) => order.status === column)) ?? "PENDING");
  const [message, setMessage] = useState<string | null>(null);
  const [pickupDetails, setPickupDetails] = useState<Record<string, { phone: string; code: string; cashCollected: boolean }>>({});
  const [isPending, startTransition] = useTransition();

  function updateOrder(orderId: string, status: OrderStatus) {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error ?? "Could not update order.");
        return;
      }
      setLocalOrders((current) => current.map((order) => order.id === orderId ? { ...order, status } : order));
      setActiveColumn(status);
    });
  }

  function updatePickup(orderId: string, changes: Partial<{ phone: string; code: string; cashCollected: boolean }>) {
    setPickupDetails((current) => {
      const existing = current[orderId] ?? { phone: "", code: "", cashCollected: false };
      return { ...current, [orderId]: { ...existing, ...changes } };
    });
  }

  function verifyPickup(order: BoardOrder) {
    const details = pickupDetails[order.id] ?? { phone: "", code: "", cashCollected: false };
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/orders/${order.id}/verify-pickup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(details),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error ?? "Could not release this pickup.");
        return;
      }
      setLocalOrders((current) => current.map((item) => item.id === order.id ? { ...item, status: "COMPLETED", fulfillmentVerified: true, hasPendingCash: false } : item));
      setPickupDetails((current) => { const next = { ...current }; delete next[order.id]; return next; });
      setActiveColumn("COMPLETED");
      setMessage(`Pickup ${order.receiptNumber} verified and released.`);
    });
  }

  return (
    <div className="space-y-4">
      {message ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</div> : null}

      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 xl:hidden" role="tablist" aria-label="Order status">
        {columns.map((column) => {
          const count = localOrders.filter((order) => order.status === column).length;
          const active = column === activeColumn;
          return (
            <button
              key={column}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveColumn(column)}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold ${active ? "bg-[var(--shop-primary)] text-white" : "border border-slate-200 bg-white text-slate-700"}`}
            >
              {titleCase(column)}
              <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-white/20" : "bg-slate-100"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        {columns.map((column) => {
          const columnOrders = localOrders
            .filter((order) => order.status === column)
            .sort((a, b) => {
              const priorityRank = { LOW: 0, NORMAL: 1, HIGH: 2, URGENT: 3 } as const;
              return priorityRank[b.priority] - priorityRank[a.priority];
            });
          return (
            <section key={column} className={`panel min-h-0 p-3 xl:min-h-[480px] ${column === activeColumn ? "block" : "hidden xl:block"}`}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">{titleCase(column)}</h2>
                <Badge>{columnOrders.length}</Badge>
              </div>
              <div className="space-y-3">
                {columnOrders.map((order) => {
                  const overdue = Boolean(order.dueAt && new Date(order.dueAt) < new Date() && !["COMPLETED", "CANCELLED"].includes(order.status));
                  const balance = Math.max(order.totalAmount - order.paidAmount, 0);
                  return (
                    <article key={order.id} className={`rounded-lg border bg-white p-3 ${order.priority === "URGENT" || order.rush ? "border-red-300 shadow-[0_0_0_3px_rgba(248,113,113,0.12)]" : "border-[#ded8cd]"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link href={`/dashboard/orders/${order.id}`} className="truncate font-semibold text-cyan-800 underline-offset-4 hover:underline">{order.receiptNumber}</Link>
                          <p className="truncate text-sm text-slate-500">{order.customerName}</p>
                        </div>
                        {order.priority === "URGENT" || order.rush ? <span title="Urgent order" className="shrink-0 rounded-lg bg-red-50 p-2 text-red-600"><AlertTriangle size={16} /></span> : null}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <Badge tone={priorityTone(order.priority)}>{titleCase(order.priority)}</Badge>
                        <Badge tone={order.approvalStatus === "APPROVED" ? "green" : order.approvalStatus === "CHANGES_REQUESTED" ? "red" : order.approvalStatus === "PENDING" ? "orange" : "slate"}>{titleCase(order.approvalStatus)}</Badge>
                        {overdue ? <Badge tone="red">Overdue</Badge> : null}
                      </div>

                      <div className="mt-3 grid gap-1.5 rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
                        <p className="flex items-center gap-2"><UserRound size={14} /><span className="truncate">{order.assignedToName ?? "Unassigned"}</span></p>
                        <p className="flex items-center gap-2"><CalendarClock size={14} />{order.dueAt ? shortDate(order.dueAt) : "No due date"}</p>
                        <p className="flex items-center gap-2"><CircleDollarSign size={14} />Paid {currency(order.paidAmount, currencyCode)} · Balance {currency(balance, currencyCode)}</p>
                      </div>

                      <div className="mt-3 space-y-2">
                        {order.items.slice(0, 3).map((item) => (
                          <div key={`${order.id}-${item.sku}`} className="rounded-lg bg-[#f6f4ef] p-2 text-xs">
                            <p className="font-semibold">{item.quantity}x {item.name}</p>
                            <p className="break-all text-slate-500">{item.sku}</p>
                            {item.personalizationData ? <p className="mt-1 text-orange-700">Personalized: {String(item.personalizationData.name ?? "")} #{String(item.personalizationData.number ?? "")}</p> : null}
                          </div>
                        ))}
                        {order.items.length > 3 ? <p className="text-xs font-semibold text-slate-500">+{order.items.length - 3} more item(s)</p> : null}
                      </div>

                      <p className="mt-3 text-sm font-semibold">{currency(order.totalAmount, currencyCode)}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <LinkButton href={`/dashboard/orders/${order.id}`} variant="outline" className="min-h-10 flex-1 px-2 py-1 text-xs">Open workflow</LinkButton>
                        {nextStatuses(order.status, role).map((status) => (
                          <Button key={status} variant={status === "CANCELLED" ? "danger" : "outline"} className="min-h-10 flex-1 px-2 py-1 text-xs sm:flex-none" disabled={isPending} onClick={() => updateOrder(order.id, status)}>
                            {status === "COMPLETED" ? <CheckCircle2 size={14} /> : <ArrowRight size={14} />}
                            {titleCase(status)}
                          </Button>
                        ))}
                      </div>
                      {order.status === "READY" && order.fulfillmentType === "PICKUP" && !order.fulfillmentVerified && (["OWNER", "MANAGER", "CASHIER"] as Role[]).includes(role) ? (
                        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                          <p className="text-xs font-semibold text-emerald-900">Verify customer before release</p>
                          {order.hasPendingOnlinePayment ? <p className="mt-1 text-xs text-red-700">Online payment is still pending.</p> : null}
                          <div className="mt-2 grid gap-2">
                            <input className="field" aria-label="Customer phone" placeholder="Customer phone" value={pickupDetails[order.id]?.phone ?? ""} onChange={(event) => updatePickup(order.id, { phone: event.target.value })} />
                            <input className="field tracking-[0.15em]" aria-label="Pickup code" inputMode="numeric" maxLength={6} placeholder="6-digit pickup code" value={pickupDetails[order.id]?.code ?? ""} onChange={(event) => updatePickup(order.id, { code: event.target.value.replace(/\D/g, "") })} />
                            {order.hasPendingCash ? <label className="flex items-start gap-2 text-xs font-semibold text-emerald-900"><input className="mt-0.5 h-5 w-5" type="checkbox" checked={pickupDetails[order.id]?.cashCollected ?? false} onChange={(event) => updatePickup(order.id, { cashCollected: event.target.checked })} />Cash has been collected</label> : null}
                            <Button className="w-full" disabled={isPending || order.hasPendingOnlinePayment} onClick={() => verifyPickup(order)}><CheckCircle2 size={14} /> Verify & release</Button>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
                {!columnOrders.length ? <p className="rounded-lg bg-white p-5 text-center text-sm text-slate-500">No {titleCase(column).toLowerCase()} orders.</p> : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
