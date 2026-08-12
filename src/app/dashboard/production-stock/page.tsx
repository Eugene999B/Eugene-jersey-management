import { randomUUID } from "node:crypto";
import { Role } from "@prisma/client";
import { Boxes, Calculator, Factory, PackageCheck, ReceiptText, RotateCcw, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { FeedbackState } from "@/components/ui/feedback-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { currency, titleCase } from "@/lib/format";
import { readProductionLibrary } from "@/lib/production-specs";
import { permissions } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import {
  adjustProductionInventoryAction,
  createProductionInventoryItemAction,
  postProductionInventoryAction,
  recordSupplierPaymentAction,
  recordSupplierReturnAction,
  saveProductionCostAction,
} from "./actions";

function number(value: { toString(): string } | number | null | undefined) {
  return Number(value ?? 0);
}

function qty(value: { toString(): string } | number, unit: string) {
  const amount = number(value);
  const digits = unit === "METRE" ? 3 : 0;
  return `${amount.toLocaleString("en-GB", { maximumFractionDigits: digits })} ${unit.toLowerCase().replace("piece", "pc")}${amount === 1 ? "" : unit === "PIECE" ? "s" : ""}`;
}

function dateTime(value: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

export default async function ProductionStockPage() {
  const session = await requireRole(permissions.suppliers);
  const { shop } = await getTenantContext();
  if (!shop) return null;
  const canCost = session.role === Role.OWNER || session.role === Role.MANAGER || session.role === Role.ACCOUNTANT;

  const [items, movements, suppliers, accountEntries, returns, receipts, costs, briefs, variants] = await Promise.all([
    prisma.productionInventoryItem.findMany({ where: { shopId: shop.id, isActive: true }, orderBy: [{ kind: "asc" }, { name: "asc" }, { size: "asc" }] }),
    prisma.productionInventoryMovement.findMany({ where: { shopId: shop.id }, orderBy: { createdAt: "desc" }, take: 80 }),
    prisma.supplier.findMany({ where: { shopId: shop.id, isActive: true }, orderBy: { name: "asc" } }),
    prisma.supplierAccountEntry.findMany({ where: { shopId: shop.id }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.supplierStockReturn.findMany({ where: { shopId: shop.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.supplierGoodsReceipt.findMany({ where: { shopId: shop.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.productionCostSnapshot.findMany({ where: { shopId: shop.id }, orderBy: { updatedAt: "desc" }, take: 100 }),
    prisma.designProductionBrief.findMany({ where: { shopId: shop.id, status: "REVIEWED" }, orderBy: { reviewedAt: "desc" }, take: 100 }),
    prisma.productVariant.findMany({ where: { product: { shopId: shop.id } }, select: { id: true, sku: true, attributes: true, product: { select: { name: true } } }, orderBy: { sku: "asc" }, take: 300 }),
  ]);
  const designIds = [...new Set(briefs.map((brief) => brief.designJobId))];
  const designs = designIds.length ? await prisma.designJob.findMany({ where: { shopId: shop.id, id: { in: designIds } }, select: { id: true, title: true, orderId: true } }) : [];
  const orderIds = [...new Set(designs.flatMap((design) => design.orderId ? [design.orderId] : []))];
  const orders = orderIds.length ? await prisma.order.findMany({ where: { shopId: shop.id, id: { in: orderIds } }, select: { id: true, receiptNumber: true, totalAmount: true } }) : [];
  const designMap = new Map(designs.map((design) => [design.id, design]));
  const orderMap = new Map(orders.map((order) => [order.id, order]));
  const costMap = new Map(costs.map((cost) => [cost.designProductionBriefId, cost]));
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const supplierMap = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
  const library = readProductionLibrary(shop.productionSetup);
  const resourceOptions = [
    ...library.garments.filter((resource) => resource.isActive).map((resource) => ({ id: resource.id, label: `Garment · ${resource.name}` })),
    ...library.materials.filter((resource) => resource.isActive).map((resource) => ({ id: resource.id, label: `Material · ${resource.name} · ${resource.colour}` })),
  ];
  const supplierBalances = new Map<string, number>();
  for (const entry of accountEntries) supplierBalances.set(entry.supplierId, (supplierBalances.get(entry.supplierId) ?? 0) + number(entry.amount));
  const stockValue = items.reduce((sum, item) => sum + number(item.quantity) * number(item.unitCost), 0);
  const lowStock = items.filter((item) => number(item.quantity) <= number(item.lowStockLevel));
  const unpostedCosts = costs.filter((cost) => !cost.inventoryPostedAt);
  const garmentItems = items.filter((item) => item.kind === "GARMENT");
  const materialItems = items.filter((item) => item.kind === "VINYL");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Stock, purchasing and costing"
        title="Production stock & true job cost"
        description="Track exact garment pieces, vinyl metres, consumables, goods received, supplier balances, waste and the frozen cost/profit of every reviewed production job."
        actions={<><LinkButton href="/dashboard/suppliers" variant="outline"><Truck size={16} /> Suppliers & purchase orders</LinkButton><LinkButton href="/dashboard/designs/materials" variant="outline"><Factory size={16} /> Materials & garment recipes</LinkButton><LinkButton href="/dashboard/designs" variant="outline"><Calculator size={16} /> Design Studio</LinkButton></>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="panel p-4"><p className="text-xs font-bold uppercase text-slate-500">Production stock value</p><p className="mt-1 text-2xl font-black">{currency(stockValue, shop.currency)}</p><p className="mt-1 text-xs text-slate-500">Current quantity × weighted unit cost</p></div>
        <div className="panel p-4"><p className="text-xs font-bold uppercase text-slate-500">Low stock</p><p className="mt-1 text-2xl font-black">{lowStock.length}</p><p className="mt-1 text-xs text-slate-500">At or below each item threshold</p></div>
        <div className="panel p-4"><p className="text-xs font-bold uppercase text-slate-500">Supplier balance</p><p className="mt-1 text-2xl font-black">{currency([...supplierBalances.values()].reduce((a, b) => a + b, 0), shop.currency)}</p><p className="mt-1 text-xs text-slate-500">Purchases less payments and return credits</p></div>
        <div className="panel p-4"><p className="text-xs font-bold uppercase text-slate-500">Costings not posted</p><p className="mt-1 text-2xl font-black">{unpostedCosts.length}</p><p className="mt-1 text-xs text-slate-500">Saved cost does not deduct stock until posted</p></div>
      </div>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#ded8cd] p-4 sm:p-5"><div className="flex items-center gap-2"><Boxes size={19} className="text-cyan-700" /><h2 className="text-lg font-bold">Create exact production stock item</h2></div><p className="mt-1 text-sm text-slate-600">Garments should be one row per colour/size. Vinyl is held in metres so remaining roll length is visible after production use and waste.</p></div>
        <form action={createProductionInventoryItemAction} className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4">
          <label className="text-sm font-semibold">Stock kind<select className="field mt-1" name="kind" required defaultValue="GARMENT"><option>GARMENT</option><option>VINYL</option><option>TRANSFER_SHEET</option><option>PACKAGING</option><option>CONSUMABLE</option><option>FINISHED_GOOD</option></select></label>
          <label className="text-sm font-semibold">Item name<input className="field mt-1" name="name" required placeholder="Black cotton tee" /></label>
          <label className="text-sm font-semibold">Colour<input className="field mt-1" name="colour" placeholder="Black / White / Gold" /></label>
          <label className="text-sm font-semibold">Exact size<input className="field mt-1" name="size" placeholder="M / L / 2XL" /></label>
          <label className="text-sm font-semibold">Stock unit<select className="field mt-1" name="unit" required defaultValue="PIECE"><option>PIECE</option><option>METRE</option><option>SHEET</option><option>PACK</option></select></label>
          <label className="text-sm font-semibold">Opening quantity<input className="field mt-1" name="openingQuantity" type="number" min="0" step="0.001" defaultValue="0" required /></label>
          <label className="text-sm font-semibold">Unit cost ({shop.currency})<input className="field mt-1" name="unitCost" type="number" min="0" step="0.0001" defaultValue="0" required /></label>
          <label className="text-sm font-semibold">Low-stock level<input className="field mt-1" name="lowStockLevel" type="number" min="0" step="0.001" defaultValue="0" required /></label>
          <label className="text-sm font-semibold sm:col-span-2">Verified production resource<select className="field mt-1" name="sourceResourceId" defaultValue=""><option value="">Not linked to a production recipe</option>{resourceOptions.map((resource) => <option key={resource.id} value={resource.id}>{resource.label}</option>)}</select></label>
          <label className="text-sm font-semibold sm:col-span-2">Catalogue variant<select className="field mt-1" name="productVariantId" defaultValue=""><option value="">Not linked to catalogue stock</option>{variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.product.name} · {variant.sku}</option>)}</select></label>
          <div className="sm:col-span-2 xl:col-span-4"><Button><PackageCheck size={16} /> Add stock item</Button></div>
        </form>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#ded8cd] p-4 sm:p-5"><h2 className="text-lg font-bold">Current production inventory</h2></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Item</th><th className="p-3">Kind</th><th className="p-3">Balance</th><th className="p-3">Unit cost</th><th className="p-3">Value</th><th className="p-3">Manual movement</th></tr></thead><tbody className="divide-y divide-[#ded8cd]">{items.map((item) => <tr key={item.id}><td className="p-3"><p className="font-bold">{item.name}</p><p className="text-xs text-slate-500">{[item.colour, item.size].filter(Boolean).join(" · ") || "No colour/size"}</p></td><td className="p-3"><Badge tone={item.kind === "VINYL" ? "blue" : item.kind === "GARMENT" ? "green" : "slate"}>{titleCase(item.kind)}</Badge></td><td className="p-3"><span className={number(item.quantity) <= number(item.lowStockLevel) ? "font-bold text-red-700" : "font-bold"}>{qty(item.quantity, item.unit)}</span><p className="text-xs text-slate-500">Low at {qty(item.lowStockLevel, item.unit)}</p></td><td className="p-3">{currency(number(item.unitCost), shop.currency)}</td><td className="p-3 font-semibold">{currency(number(item.quantity) * number(item.unitCost), shop.currency)}</td><td className="p-3"><form action={adjustProductionInventoryAction} className="flex min-w-[430px] items-end gap-2"><input type="hidden" name="submissionId" value={randomUUID()} /><input type="hidden" name="inventoryItemId" value={item.id} /><label className="text-xs font-semibold">Type<select className="field mt-1 min-w-36" name="type" defaultValue="WASTE"><option>WASTE</option><option>DAMAGE</option><option>ADJUSTMENT_IN</option><option>ADJUSTMENT_OUT</option><option>FINISHED_GOOD_IN</option></select></label><label className="text-xs font-semibold">Qty<input className="field mt-1 w-24" name="quantity" type="number" min="0.001" step="0.001" required /></label><label className="text-xs font-semibold">Reason<input className="field mt-1 min-w-44" name="note" required /></label><ConfirmActionButton confirmation="Record this manual production-stock movement? It will change the current stock balance and add a permanent movement record." variant="outline" size="sm">Record</ConfirmActionButton></form></td></tr>)}{!items.length ? <tr><td className="p-5 text-slate-500" colSpan={6}>No production inventory has been created yet.</td></tr> : null}</tbody></table></div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="panel p-4 sm:p-5"><h2 className="flex items-center gap-2 text-lg font-bold"><ReceiptText size={19} /> Supplier balances & payments</h2><form action={recordSupplierPaymentAction} className="mt-4 grid gap-3 sm:grid-cols-2"><input type="hidden" name="submissionId" value={randomUUID()} /><label className="text-sm font-semibold sm:col-span-2">Supplier<select className="field mt-1" name="supplierId" required defaultValue=""><option value="" disabled>Choose supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name} · balance {currency(supplierBalances.get(supplier.id) ?? 0, shop.currency)}</option>)}</select></label><label className="text-sm font-semibold">Payment amount<input className="field mt-1" name="amount" type="number" min="0.01" step="0.01" required /></label><label className="text-sm font-semibold">Reference<input className="field mt-1" name="reference" placeholder="Transfer / cash reference" /></label><label className="text-sm font-semibold sm:col-span-2">Note<input className="field mt-1" name="note" /></label><div className="sm:col-span-2"><ConfirmActionButton confirmation="Record this supplier payment now? This immediately reduces the supplier balance and becomes part of the permanent supplier account history." variant="secondary">Record supplier payment</ConfirmActionButton></div></form><div className="mt-5 divide-y divide-[#ded8cd] border-t border-[#ded8cd]">{suppliers.map((supplier) => <div key={supplier.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="font-semibold">{supplier.name}</span><span className={(supplierBalances.get(supplier.id) ?? 0) > 0 ? "font-black text-orange-700" : "font-black text-emerald-700"}>{currency(supplierBalances.get(supplier.id) ?? 0, shop.currency)}</span></div>)}</div></section>
        <section className="panel p-4 sm:p-5"><h2 className="flex items-center gap-2 text-lg font-bold"><RotateCcw size={19} /> Return stock to supplier</h2><form action={recordSupplierReturnAction} className="mt-4 grid gap-3 sm:grid-cols-2"><input type="hidden" name="submissionId" value={randomUUID()} /><label className="text-sm font-semibold">Supplier<select className="field mt-1" name="supplierId" required defaultValue=""><option value="" disabled>Choose supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label><label className="text-sm font-semibold">Stock item<select className="field mt-1" name="inventoryItemId" required defaultValue=""><option value="" disabled>Choose production stock</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.colour || "-"} {item.size || ""} · {qty(item.quantity, item.unit)}</option>)}</select></label><label className="text-sm font-semibold">Quantity<input className="field mt-1" name="quantity" type="number" min="0.001" step="0.001" required /></label><label className="text-sm font-semibold">Return unit cost<input className="field mt-1" name="unitCost" type="number" min="0" step="0.0001" required /></label><label className="text-sm font-semibold sm:col-span-2">Reason<input className="field mt-1" name="reason" required placeholder="Defective roll / wrong size / supplier return" /></label><label className="text-sm font-semibold sm:col-span-2">Reference<input className="field mt-1" name="reference" /></label><div className="sm:col-span-2"><ConfirmActionButton confirmation="Return this stock to the supplier now? This reduces production stock and posts a supplier credit. Verify the quantity and cost before continuing." variant="danger">Record return and supplier credit</ConfirmActionButton></div></form></section>
      </div>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#ded8cd] p-4 sm:p-5"><h2 className="flex items-center gap-2 text-lg font-bold"><Calculator size={19} /> True cost & profit by reviewed production job</h2><p className="mt-1 text-sm text-slate-600">Saving a cost estimate never changes stock. Posting consumption is a separate, idempotent step that deducts one garment plus used vinyl and recorded waste exactly once.</p></div>
        <div className="divide-y divide-[#ded8cd]">{briefs.map((brief) => { const design = designMap.get(brief.designJobId); const order = design?.orderId ? orderMap.get(design.orderId) : null; const cost = costMap.get(brief.id); return <article key={brief.id} className="p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold">{design?.title ?? "Reviewed production job"}</h3><p className="mt-1 text-sm text-slate-500">{order ? `${order.receiptNumber} · order ${currency(number(order.totalAmount), shop.currency)}` : "No linked order"} · reviewed {brief.reviewedAt ? dateTime(brief.reviewedAt) : "earlier"}</p></div>{cost ? <Badge tone={cost.inventoryPostedAt ? "green" : "orange"}>{cost.inventoryPostedAt ? "Inventory posted" : "Cost saved"}</Badge> : <Badge tone="slate">Not costed</Badge>}</div>{cost ? <div className="mt-4 grid gap-2 sm:grid-cols-4"><div className="rounded-xl bg-slate-100 p-3"><p className="text-xs uppercase text-slate-500">True cost</p><p className="font-black">{currency(number(cost.totalCost), shop.currency)}</p></div><div className="rounded-xl bg-blue-50 p-3"><p className="text-xs uppercase text-blue-700">Revenue</p><p className="font-black">{currency(number(cost.revenue), shop.currency)}</p></div><div className={`rounded-xl p-3 ${number(cost.profit) >= 0 ? "bg-emerald-50" : "bg-red-50"}`}><p className="text-xs uppercase text-slate-600">Profit</p><p className="font-black">{currency(number(cost.profit), shop.currency)}</p></div><div className="rounded-xl bg-slate-100 p-3"><p className="text-xs uppercase text-slate-500">Margin</p><p className="font-black">{number(cost.marginPercent).toFixed(1)}%</p></div></div> : null}{canCost && !cost?.inventoryPostedAt ? <form action={saveProductionCostAction} className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><input type="hidden" name="designProductionBriefId" value={brief.id} /><label className="text-xs font-semibold xl:col-span-2">Exact garment stock<select className="field mt-1" name="garmentInventoryItemId" required defaultValue={cost?.garmentInventoryItemId ?? ""}><option value="" disabled>Choose garment colour/size</option>{garmentItems.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.colour || "-"} · {item.size || "-"} · {qty(item.quantity, item.unit)}</option>)}</select></label><label className="text-xs font-semibold xl:col-span-2">Vinyl/material stock<select className="field mt-1" name="materialInventoryItemId" required defaultValue={cost?.materialInventoryItemId ?? ""}><option value="" disabled>Choose vinyl roll stock</option>{materialItems.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.colour || "-"} · {qty(item.quantity, item.unit)}</option>)}</select></label><label className="text-xs font-semibold">Revenue<input className="field mt-1" name="revenue" type="number" min="0" step="0.01" defaultValue={cost ? number(cost.revenue) : order ? number(order.totalAmount) : 0} /></label><label className="text-xs font-semibold">Vinyl used (m)<input className="field mt-1" name="materialUsedMetres" type="number" min="0" step="0.001" defaultValue={cost ? number(cost.materialUsedMetres) : (brief.cutSheetHeightMm / 1000).toFixed(3)} /></label><label className="text-xs font-semibold">Waste (m)<input className="field mt-1" name="materialWasteMetres" type="number" min="0" step="0.001" defaultValue={cost ? number(cost.materialWasteMetres) : 0} /></label><label className="text-xs font-semibold">Labour cost<input className="field mt-1" name="labourCost" type="number" min="0" step="0.01" defaultValue={cost ? number(cost.labourCost) : 0} /></label><label className="text-xs font-semibold">Design cost<input className="field mt-1" name="designCharge" type="number" min="0" step="0.01" defaultValue={cost ? number(cost.designCharge) : 0} /></label><label className="text-xs font-semibold">Pressing cost<input className="field mt-1" name="pressingCharge" type="number" min="0" step="0.01" defaultValue={cost ? number(cost.pressingCharge) : 0} /></label><label className="text-xs font-semibold">Extra services<input className="field mt-1" name="additionalServicesCost" type="number" min="0" step="0.01" defaultValue={cost ? number(cost.additionalServicesCost) : 0} /></label><div className="flex items-end"><Button>{cost ? "Recalculate cost" : "Save true cost"}</Button></div></form> : null}{canCost && cost && !cost.inventoryPostedAt ? <form action={postProductionInventoryAction} className="mt-3"><input type="hidden" name="costId" value={cost.id} /><ConfirmActionButton confirmation="Post this reviewed job to production stock now? This permanently consumes one garment plus the saved material use and waste, and locks the posted cost against later edits." variant="outline">Post garment, material use and waste to stock</ConfirmActionButton></form> : null}{!canCost && !cost?.inventoryPostedAt ? <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Costing and production-stock posting are managed by the owner, manager or accountant. You can continue managing stock and purchasing records.</p> : null}</article>; })}{!briefs.length ? <div className="p-5"><FeedbackState state="empty" title="No reviewed production jobs to cost" description="Approve a garment/material production review in Guided production first." /></div> : null}</div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="panel overflow-hidden"><div className="border-b border-[#ded8cd] p-4"><h2 className="font-bold">Recent stock movements</h2></div><div className="divide-y divide-[#ded8cd]">{movements.slice(0, 20).map((movement) => { const item = itemMap.get(movement.inventoryItemId); return <div key={movement.id} className="grid gap-1 p-3 text-sm sm:grid-cols-[1fr_auto]"><div><p className="font-semibold">{item?.name ?? "Inventory item"} · {titleCase(movement.type)}</p><p className="text-xs text-slate-500">{movement.note ?? movement.referenceType ?? "Stock movement"} · {dateTime(movement.createdAt)}</p></div><div className={number(movement.quantityDelta) < 0 ? "font-black text-red-700" : "font-black text-emerald-700"}>{number(movement.quantityDelta) > 0 ? "+" : ""}{number(movement.quantityDelta).toFixed(item?.unit === "METRE" ? 3 : 0)} → {number(movement.balanceAfter).toFixed(item?.unit === "METRE" ? 3 : 0)}</div></div>; })}{!movements.length ? <p className="p-4 text-sm text-slate-500">No stock movements recorded.</p> : null}</div></section>
        <section className="panel overflow-hidden"><div className="border-b border-[#ded8cd] p-4"><h2 className="font-bold">Purchasing evidence</h2></div><div className="divide-y divide-[#ded8cd]">{receipts.slice(0, 10).map((receipt) => <div key={receipt.id} className="p-3 text-sm"><p className="font-semibold">{receipt.receiptNumber} · {supplierMap.get(receipt.supplierId)?.name ?? "Supplier"}</p><p className="text-xs text-slate-500">Goods received {dateTime(receipt.createdAt)} · {currency(number(receipt.totalAmount), shop.currency)}</p></div>)}{returns.slice(0, 10).map((row) => <div key={row.id} className="p-3 text-sm"><p className="font-semibold">Return · {supplierMap.get(row.supplierId)?.name ?? "Supplier"} · {itemMap.get(row.productionInventoryItemId)?.name ?? "Stock"}</p><p className="text-xs text-slate-500">{number(row.quantity)} returned · {row.reason} · {dateTime(row.createdAt)}</p></div>)}{!receipts.length && !returns.length ? <p className="p-4 text-sm text-slate-500">Goods receipts and supplier returns will appear here.</p> : null}</div></section>
      </div>
    </div>
  );
}
