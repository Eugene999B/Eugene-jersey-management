import { Boxes, PackageCheck, Plus, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { createSupplierAction, createSupplierOrderAction, receiveSupplierOrderAction } from "@/app/dashboard/suppliers/actions";
import { prisma } from "@/lib/db";
import { currency, shortDate, titleCase } from "@/lib/format";
import { getTenantContext } from "@/lib/tenant";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";

export default async function SuppliersPage() {
  await requireRole(permissions.suppliers);
  const { shop } = await getTenantContext();
  if (!shop) return null;

  const [suppliers, variants, orders, productionItems, accountEntries] = await Promise.all([
    prisma.supplier.findMany({ where: { shopId: shop.id }, include: { portalUser: true, supplierOrders: true }, orderBy: { name: "asc" } }),
    prisma.productVariant.findMany({ where: { product: { shopId: shop.id } }, include: { product: true }, orderBy: { sku: "asc" }, take: 200 }),
    prisma.supplierOrder.findMany({ where: { shopId: shop.id }, include: { supplier: true, items: true }, orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.productionInventoryItem.findMany({ where: { shopId: shop.id, isActive: true }, orderBy: [{ kind: "asc" }, { name: "asc" }], take: 300 }),
    prisma.supplierAccountEntry.findMany({ where: { shopId: shop.id }, select: { supplierId: true, amount: true } }),
  ]);

  const openOrders = orders.filter((order) => order.status !== "RECEIVED" && order.status !== "CANCELLED");
  const incomingValue = openOrders.reduce((sum, order) => sum + Number(order.totalAmount), 0);
  const supplierBalance = accountEntries.reduce((sum, entry) => sum + Number(entry.amount), 0);

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold">Suppliers</h1><p className="mt-2 text-sm text-slate-500">Manage supplier records, portal logins, purchase orders, receiving, cost history and production-stock replenishment.</p></div><LinkButton href="/dashboard/production-stock" variant="outline"><Boxes size={16} /> Production stock & costing</LinkButton></div>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <StatCard label="Suppliers" value={String(suppliers.length)} icon={<Truck size={20} />} />
        <StatCard label="Open POs" value={String(openOrders.length)} />
        <StatCard label="Incoming value" value={currency(incomingValue, shop.currency)} />
        <StatCard label="Supplier balance" value={currency(supplierBalance, shop.currency)} />
        <StatCard label="Portal logins" value={String(suppliers.filter((supplier) => supplier.portalUserId).length)} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.68fr_1.32fr] xl:gap-5">
        <div className="space-y-4 sm:space-y-5">
          <div className="panel p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2"><Plus size={18} className="text-[var(--shop-primary)]" /><h2 className="text-lg font-semibold">Add supplier</h2></div>
            <form action={createSupplierAction} className="space-y-3">
              <input className="field" name="name" placeholder="Supplier company" required />
              <input className="field" name="contactName" placeholder="Contact person" />
              <div className="grid gap-2 sm:grid-cols-2"><input className="field" name="email" type="email" placeholder="Email" /><input className="field" name="phone" placeholder="Phone" /></div>
              <input className="field" name="categories" placeholder="Garments, food, electronics, materials..." />
              <input className="field" name="paymentTerms" placeholder="Payment terms" />
              <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2"><input className="field" name="leadTimeDays" type="number" min="0" defaultValue="7" placeholder="Lead days" /><input className="field" name="rating" type="number" min="1" max="5" defaultValue="5" placeholder="Rating" /></div>
              <div className="rounded-xl bg-white p-3"><p className="mb-2 text-sm font-semibold">Supplier portal login</p><input className="field" name="portalEmail" type="email" placeholder="supplier-login@example.com" /><input className="field mt-2" name="portalPassword" type="password" minLength={8} autoComplete="new-password" placeholder="Temporary password (8+ characters)" /></div>
              <Button className="w-full">Save supplier</Button>
            </form>
          </div>

          <div className="panel p-4 sm:p-5">
            <h2 className="text-lg font-semibold">Create purchase order</h2>
            <p className="mt-1 text-xs text-slate-500">Link a line to catalogue stock, production stock, both, or neither. Receiving updates every linked ledger in one transaction.</p>
            <form action={createSupplierOrderAction} className="mt-4 space-y-3">
              <select className="field" name="supplierId" required><option value="">Select supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select>
              <label className="block text-xs font-semibold text-slate-600">Catalogue variant<select className="field mt-1" name="productVariantId"><option value="">No catalogue stock link</option>{variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.sku} - {variant.product.name}</option>)}</select></label>
              <label className="block text-xs font-semibold text-slate-600">Production stock item<select className="field mt-1" name="productionInventoryItemId"><option value="">No production stock link</option>{productionItems.map((item) => <option key={item.id} value={item.id}>{titleCase(item.kind)} · {item.name} · {[item.colour, item.size].filter(Boolean).join(" ") || "no option"}</option>)}</select></label>
              {!productionItems.length ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Create exact garment/vinyl stock in Production stock & costing before linking a purchase order.</p> : null}
              <input className="field" name="description" placeholder="Item description" required />
              <div className="grid gap-2 sm:grid-cols-3"><input className="field" name="quantity" type="number" min="1" placeholder="Qty" required /><input className="field" name="unitCost" type="number" min="0" step="0.0001" placeholder="Unit cost" required /><input className="field" name="expectedAt" type="date" /></div>
              <textarea className="field min-h-20" name="notes" placeholder="Sizes, colors, print specs, delivery notes" />
              <Button className="w-full">Send purchase order</Button>
            </form>
          </div>
        </div>

        <div className="space-y-4 sm:space-y-5">
          <section className="panel overflow-hidden">
            <div className="border-b border-[#ded8cd] p-4 sm:p-5"><h2 className="text-lg font-semibold">Supplier directory</h2></div>
            <div className="grid gap-3 p-3 sm:p-5 md:grid-cols-2">
              {suppliers.map((supplier) => (
                <article key={supplier.id} className="min-w-0 rounded-xl border border-[#ded8cd] bg-white p-4">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-semibold">{supplier.name}</h3><p className="mt-1 break-words text-sm text-slate-500">{supplier.contactName ?? "No contact"} · {supplier.phone ?? supplier.email ?? "No contact detail"}</p></div><Badge className="shrink-0" tone={supplier.isActive ? "green" : "red"}>{supplier.isActive ? "Active" : "Off"}</Badge></div>
                  <p className="mt-3 break-words text-sm text-slate-600">{supplier.categories ?? "No categories listed"}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs"><Badge>{supplier.leadTimeDays} day lead</Badge><Badge>{supplier.rating}/5 rating</Badge>{supplier.portalUser ? <Badge tone="blue">Portal login</Badge> : null}</div>
                </article>
              ))}
              {!suppliers.length ? <p className="text-sm text-slate-500">No suppliers yet.</p> : null}
            </div>
          </section>

          <section className="panel overflow-hidden">
            <div className="border-b border-[#ded8cd] p-4 sm:p-5"><h2 className="text-lg font-semibold">Purchase orders</h2></div>
            <div className="divide-y divide-[#ded8cd] bg-white">
              {orders.map((order) => (
                <article key={order.id} className="grid min-w-0 gap-3 p-3 sm:p-4 lg:grid-cols-[1fr_180px]">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold">{order.orderNumber}</p><Badge tone={order.status === "RECEIVED" ? "green" : "orange"}>{titleCase(order.status)}</Badge></div><p className="mt-1 text-sm text-slate-500">{order.supplier.name} · {currency(order.totalAmount.toString(), shop.currency)}</p><p className="mt-2 break-words text-sm text-slate-600">{order.items.map((item) => `${item.quantity}x ${item.description}`).join(", ")}</p><p className="mt-2 text-xs text-slate-400">Created {shortDate(order.createdAt)} {order.expectedAt ? `· expected ${shortDate(order.expectedAt)}` : ""}</p></div>
                  <form action={receiveSupplierOrderAction} className="self-end"><input type="hidden" name="orderId" value={order.id} /><Button variant="outline" className="w-full" disabled={order.status === "RECEIVED"}><PackageCheck size={16} /> Receive & post stock</Button></form>
                </article>
              ))}
              {!orders.length ? <p className="p-5 text-sm text-slate-500">No purchase orders yet.</p> : null}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
