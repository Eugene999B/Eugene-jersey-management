import { PackageCheck, Truck } from "lucide-react";
import { Role } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/auth/logout-button";
import { acknowledgeSupplierOrderAction } from "@/app/supplier/actions";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { currency, shortDate, titleCase } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SupplierPortalPage() {
  const session = await requireRole([Role.SUPPLIER]);
  const supplier = await prisma.supplier.findFirst({
    where: { portalUserId: session.id, isActive: true, shop: { isActive: true } },
    include: {
      shop: true,
      supplierOrders: { include: { items: true }, orderBy: { createdAt: "desc" }, take: 80 },
    },
  });

  if (!supplier) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4 sm:p-6">
        <div className="panel max-w-md p-5 text-center sm:p-6">
          <h1 className="text-2xl font-semibold">Supplier portal unavailable</h1>
          <p className="mt-3 text-sm text-slate-500">This supplier profile is inactive or no longer linked to an active shop.</p>
          <LogoutButton className="mt-5 bg-slate-950 text-white hover:bg-slate-800" />
        </div>
      </main>
    );
  }

  const style = { "--shop-primary": supplier.shop.primaryColor, "--shop-secondary": supplier.shop.secondaryColor } as React.CSSProperties;
  const openOrders = supplier.supplierOrders.filter((order) => order.status !== "RECEIVED" && order.status !== "CANCELLED").length;
  const orderValue = supplier.supplierOrders.reduce((sum, order) => sum + Number(order.totalAmount), 0);

  return (
    <main style={style} className="min-h-screen bg-slate-100 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-3 py-3 shadow-sm backdrop-blur sm:px-5 sm:py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="shrink-0 rounded-xl bg-[var(--shop-primary)] p-2.5 text-white sm:p-3"><Truck size={21} /></div>
            <div className="min-w-0"><p className="truncate text-xs text-slate-500 sm:text-sm">Supplier portal for {supplier.shop.name}</p><h1 className="truncate text-lg font-semibold sm:text-2xl">{supplier.name}</h1></div>
          </div>
          <LogoutButton className="shrink-0 border border-slate-200 bg-white px-3 text-slate-800 hover:bg-red-50 hover:text-red-700" label="Sign out" />
        </div>
      </header>

      <section className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:space-y-5 sm:px-5 sm:py-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="panel p-3 sm:p-4"><p className="text-[10px] font-semibold uppercase text-slate-500 sm:text-xs">Open orders</p><p className="mt-2 text-2xl font-semibold sm:text-3xl">{openOrders}</p></div>
          <div className="panel p-3 sm:p-4"><p className="text-[10px] font-semibold uppercase text-slate-500 sm:text-xs">Total order value</p><p className="mt-2 truncate text-xl font-semibold sm:text-3xl">{currency(orderValue, supplier.shop.currency)}</p></div>
          <div className="panel col-span-2 p-3 sm:p-4 md:col-span-1"><p className="text-[10px] font-semibold uppercase text-slate-500 sm:text-xs">Lead time</p><p className="mt-2 text-2xl font-semibold sm:text-3xl">{supplier.leadTimeDays} days</p></div>
        </div>

        <section className="panel overflow-hidden">
          <div className="border-b border-slate-200 p-4 sm:p-5"><h2 className="text-lg font-semibold">Purchase orders from {supplier.shop.name}</h2><p className="mt-1 text-sm text-slate-500">Review specifications and acknowledge new orders from your phone.</p></div>
          <div className="divide-y divide-slate-200 bg-white">
            {supplier.supplierOrders.map((order) => (
              <article key={order.id} className="grid min-w-0 gap-3 p-3 sm:p-4 lg:grid-cols-[1fr_180px]">
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-3"><p className="min-w-0 truncate font-semibold">{order.orderNumber}</p><Badge className="shrink-0" tone={order.status === "RECEIVED" ? "green" : "orange"}>{titleCase(order.status)}</Badge></div>
                  <p className="mt-1 text-sm text-slate-500">{currency(order.totalAmount.toString(), supplier.shop.currency)} · {shortDate(order.createdAt)}</p>
                  <div className="mt-3 space-y-2">{order.items.map((item) => <div key={item.id} className="rounded-xl bg-slate-50 p-3 text-sm"><p className="font-semibold">{item.quantity}x {item.description}</p><p className="mt-1 text-xs text-slate-500">Received {item.receivedQty} of {item.quantity}</p></div>)}</div>
                  {order.notes ? <p className="mt-3 break-words text-sm text-slate-500">{order.notes}</p> : null}
                </div>
                <form action={acknowledgeSupplierOrderAction} className="self-end"><input type="hidden" name="orderId" value={order.id} /><Button variant="outline" className="w-full" disabled={order.status !== "SENT"}><PackageCheck size={16} /> Acknowledge</Button></form>
              </article>
            ))}
            {!supplier.supplierOrders.length ? <p className="p-5 text-sm text-slate-500">No purchase orders yet.</p> : null}
          </div>
        </section>
      </section>
    </main>
  );
}
