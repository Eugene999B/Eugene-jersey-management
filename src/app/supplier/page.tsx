import Link from "next/link";
import { PackageCheck, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { acknowledgeSupplierOrderAction } from "@/app/supplier/actions";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { currency, shortDate, titleCase } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SupplierPortalPage() {
  const session = await requireSession();
  const supplier = await prisma.supplier.findUnique({
    where: { portalUserId: session.id },
    include: {
      shop: true,
      supplierOrders: {
        include: { items: true },
        orderBy: { createdAt: "desc" },
        take: 80,
      },
    },
  });

  if (!supplier) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f4ef] p-6">
        <div className="panel max-w-md p-6 text-center">
          <h1 className="text-2xl font-semibold">Supplier portal unavailable</h1>
          <p className="mt-3 text-sm text-slate-500">Your login is not linked to a supplier profile yet.</p>
          <Link className="mt-5 inline-flex rounded-[8px] bg-slate-950 px-4 py-2 text-sm font-semibold text-white" href="/logout">Sign out</Link>
        </div>
      </main>
    );
  }

  const style = {
    "--shop-primary": supplier.shop.primaryColor,
    "--shop-secondary": supplier.shop.secondaryColor,
  } as React.CSSProperties;

  return (
    <main style={style} className="min-h-screen bg-[#f6f4ef]">
      <header className="border-b border-[#ded8cd] bg-white px-5 py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-[8px] bg-[var(--shop-primary)] p-3 text-white"><Truck size={22} /></div>
            <div>
              <p className="text-sm text-slate-500">Supplier portal for {supplier.shop.name}</p>
              <h1 className="text-2xl font-semibold">{supplier.name}</h1>
            </div>
          </div>
          <Link className="rounded-[8px] border border-[#ded8cd] bg-white px-4 py-2 text-sm font-semibold" href="/logout">Sign out</Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl space-y-5 px-5 py-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="panel p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Open orders</p>
            <p className="mt-2 text-3xl font-semibold">{supplier.supplierOrders.filter((order) => order.status !== "RECEIVED" && order.status !== "CANCELLED").length}</p>
          </div>
          <div className="panel p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Total order value</p>
            <p className="mt-2 text-3xl font-semibold">{currency(supplier.supplierOrders.reduce((sum, order) => sum + Number(order.totalAmount), 0), supplier.shop.currency)}</p>
          </div>
          <div className="panel p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Lead time</p>
            <p className="mt-2 text-3xl font-semibold">{supplier.leadTimeDays} days</p>
          </div>
        </div>

        <section className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-5">
            <h2 className="text-lg font-semibold">Purchase orders from {supplier.shop.name}</h2>
          </div>
          <div className="divide-y divide-[#ded8cd] bg-white">
            {supplier.supplierOrders.map((order) => (
              <article key={order.id} className="grid gap-4 p-4 lg:grid-cols-[1fr_180px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{order.orderNumber}</p>
                    <Badge tone={order.status === "RECEIVED" ? "green" : "orange"}>{titleCase(order.status)}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{currency(order.totalAmount.toString(), supplier.shop.currency)} - {shortDate(order.createdAt)}</p>
                  <p className="mt-2 text-sm text-slate-700">{order.items.map((item) => `${item.quantity}x ${item.description}`).join(", ")}</p>
                  {order.notes ? <p className="mt-2 text-sm text-slate-500">{order.notes}</p> : null}
                </div>
                <form action={acknowledgeSupplierOrderAction}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <Button variant="outline" className="w-full" disabled={order.status !== "SENT"}>
                    <PackageCheck size={16} /> Acknowledge
                  </Button>
                </form>
              </article>
            ))}
            {!supplier.supplierOrders.length ? <p className="p-5 text-sm text-slate-500">No purchase orders yet.</p> : null}
          </div>
        </section>
      </section>
    </main>
  );
}
