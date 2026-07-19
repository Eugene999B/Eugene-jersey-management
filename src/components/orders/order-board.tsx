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

  return columns.filter((column) => column !== status);
}

export function OrderBoard({ orders, role, currencyCode }: { orders: BoardOrder[]; role: Role; currencyCode: string }) {
  const [localOrders, setLocalOrders] = useState(orders);
  const [message, setMessage] = useState<string | null>(null);
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
                      {nextStatuses(order.status, role).slice(0, 3).map((status) => (
                        <Button key={status} variant={status === "CANCELLED" ? "danger" : "outline"} className="min-h-8 px-2 py-1 text-xs" disabled={isPending} onClick={() => updateOrder(order.id, status)}>
                          {status === "COMPLETED" ? <CheckCircle2 size={14} /> : <ArrowRight size={14} />}
                          {titleCase(status)}
                        </Button>
                      ))}
                    </div>
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
