"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { OrderStatus, Role } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { currency, titleCase } from "@/lib/format";

type BoardOrder = {
  id: string;
  receiptNumber: string;
  customerName: string;
  status: OrderStatus;
  rush: boolean;
  fulfillmentType: "PICKUP" | "DELIVERY";
  fulfillmentVerified: boolean;
  hasPendingCash: boolean;
  hasPendingOnlinePayment: boolean;
  totalAmount: number;
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

export function OrderBoard({ orders, role, currencyCode }: { orders: BoardOrder[]; role: Role; currencyCode: string }) {
  const [localOrders, setLocalOrders] = useState(orders);
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
      setMessage(`Pickup ${order.receiptNumber} verified and released.`);
    });
  }

  return (
    <div className="space-y-4">
      {message ? <div className="rounded-[8px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</div> : null}
      <div className="grid gap-4 xl:grid-cols-5">
        {columns.map((column) => {
          const columnOrders = localOrders
            .filter((order) => order.status === column)
            .sort((a, b) => Number(b.rush) - Number(a.rush));
          return (
            <section key={column} className="panel min-h-[480px] p-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">{titleCase(column)}</h2>
                <Badge>{columnOrders.length}</Badge>
              </div>
              <div className="space-y-3">
                {columnOrders.map((order) => (
                  <article key={order.id} className={`rounded-[8px] border bg-white p-3 ${order.rush ? "border-red-300 shadow-[0_0_0_3px_rgba(248,113,113,0.12)]" : "border-[#ded8cd]"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{order.receiptNumber}</p>
                        <p className="text-sm text-slate-500">{order.customerName}</p>
                      </div>
                      {order.rush ? (
                        <span title="Rush order" className="rounded-[8px] bg-red-50 p-2 text-red-600">
                          <AlertTriangle size={16} />
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 space-y-2">
                      {order.items.map((item) => (
                        <div key={`${order.id}-${item.sku}`} className="rounded-[8px] bg-[#f6f4ef] p-2 text-xs">
                          <p className="font-semibold">{item.quantity}x {item.name}</p>
                          <p className="text-slate-500">{item.sku}</p>
                          {item.personalizationData ? (
                            <p className="mt-1 text-orange-700">Personalized: {String(item.personalizationData.name ?? "")} #{String(item.personalizationData.number ?? "")}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-sm font-semibold">{currency(order.totalAmount, currencyCode)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {nextStatuses(order.status, role).map((status) => (
                        <Button key={status} variant={status === "CANCELLED" ? "danger" : "outline"} className="min-h-8 px-2 py-1 text-xs" disabled={isPending} onClick={() => updateOrder(order.id, status)}>
                          {status === "COMPLETED" ? <CheckCircle2 size={14} /> : <ArrowRight size={14} />}
                          {titleCase(status)}
                        </Button>
                      ))}
                    </div>
                    {order.status === "READY" && order.fulfillmentType === "PICKUP" && !order.fulfillmentVerified && (["OWNER", "MANAGER", "CASHIER"] as Role[]).includes(role) ? (
                      <div className="mt-3 rounded-[8px] border border-emerald-200 bg-emerald-50 p-3">
                        <p className="text-xs font-semibold text-emerald-900">Verify customer before release</p>
                        {order.hasPendingOnlinePayment ? <p className="mt-1 text-xs text-red-700">Online payment is still pending.</p> : null}
                        <div className="mt-2 grid gap-2">
                          <input className="field" aria-label="Customer phone" placeholder="Customer phone" value={pickupDetails[order.id]?.phone ?? ""} onChange={(event) => updatePickup(order.id, { phone: event.target.value })} />
                          <input className="field tracking-[0.15em]" aria-label="Pickup code" inputMode="numeric" maxLength={6} placeholder="6-digit pickup code" value={pickupDetails[order.id]?.code ?? ""} onChange={(event) => updatePickup(order.id, { code: event.target.value.replace(/\D/g, "") })} />
                          {order.hasPendingCash ? <label className="flex items-start gap-2 text-xs font-semibold text-emerald-900"><input className="mt-0.5" type="checkbox" checked={pickupDetails[order.id]?.cashCollected ?? false} onChange={(event) => updatePickup(order.id, { cashCollected: event.target.checked })} />Cash has been collected</label> : null}
                          <Button className="w-full" disabled={isPending || order.hasPendingOnlinePayment} onClick={() => verifyPickup(order)}><CheckCircle2 size={14} /> Verify & release</Button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
