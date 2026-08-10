import {
  AlertTriangle,
  Banknote,
  Boxes,
  CheckCircle2,
  Clock3,
  Factory,
  PackageCheck,
  Percent,
  Scissors,
  Shirt,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import { ProductionInventoryKind, ProductionInventoryMovementType } from "@prisma/client";
import { ReportActions } from "@/components/reports/report-actions";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { currency, titleCase } from "@/lib/format";
import {
  cashFlowSummary,
  costSnapshotReconciliation,
  money,
  onTimeSummary,
  outstandingOrderBalance,
  paymentMethodTotals,
  reworkSummary,
} from "@/lib/reporting-analytics";
import { listCompletedOrderTimings } from "@/lib/reporting-data";
import { hasRole, permissions } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";

function inputDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function validDate(value: string | undefined, fallback: Date, endOfDay = false) {
  if (!value) return fallback;
  const parsed = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function quantity(value: number, digits = 3) {
  return value.toLocaleString("en-GB", { maximumFractionDigits: digits });
}

type Props = { searchParams?: Promise<{ from?: string; to?: string }> };

export default async function ReportsPage({ searchParams }: Props) {
  await requireRole(permissions.reportsRead);
  const params = (await searchParams) ?? {};
  const { shop, session } = await getTenantContext();
  if (!shop) return null;

  const now = new Date();
  const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const defaultTo = new Date();
  const parsedFrom = validDate(params.from, defaultFrom);
  const parsedTo = validDate(params.to, defaultTo, true);
  const start = parsedFrom <= parsedTo ? parsedFrom : defaultFrom;
  const end = parsedFrom <= parsedTo ? parsedTo : defaultTo;
  const range = { gte: start, lte: end };

  const [
    periodOrders,
    periodPayments,
    currentOrders,
    currentDebts,
    debtPayments,
    supplierEntries,
    suppliers,
    inventoryItems,
    inventoryMovements,
    costSnapshots,
    closings,
    heatPressRuns,
    reworkEvents,
    staff,
    customRequests,
    timings,
  ] = await Promise.all([
    prisma.order.findMany({
      where: { shopId: shop.id, status: { not: "CANCELLED" }, createdAt: range },
      include: { payments: true, customer: true, processedBy: true },
      orderBy: { createdAt: "desc" },
      take: 1500,
    }),
    prisma.payment.findMany({
      where: { order: { shopId: shop.id }, createdAt: range },
      include: { order: { select: { receiptNumber: true } } },
      orderBy: { createdAt: "desc" },
      take: 3000,
    }),
    prisma.order.findMany({
      where: { shopId: shop.id, status: { not: "CANCELLED" } },
      include: { payments: true, customer: true },
      orderBy: { createdAt: "desc" },
      take: 3000,
    }),
    prisma.debt.findMany({ where: { shopId: shop.id }, include: { customer: true }, orderBy: { dueDate: "asc" }, take: 2000 }),
    prisma.debtPayment.findMany({ where: { shopId: shop.id, receivedAt: range }, orderBy: { receivedAt: "desc" }, take: 3000 }),
    prisma.supplierAccountEntry.findMany({ where: { shopId: shop.id }, orderBy: { createdAt: "desc" }, take: 5000 }),
    prisma.supplier.findMany({ where: { shopId: shop.id }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.productionInventoryItem.findMany({ where: { shopId: shop.id, isActive: true }, orderBy: [{ kind: "asc" }, { name: "asc" }] }),
    prisma.productionInventoryMovement.findMany({
      where: {
        shopId: shop.id,
        createdAt: range,
        type: { in: [ProductionInventoryMovementType.PRODUCTION_USE, ProductionInventoryMovementType.WASTE] },
      },
      orderBy: { createdAt: "desc" },
      take: 5000,
    }),
    prisma.productionCostSnapshot.findMany({ where: { shopId: shop.id, updatedAt: range }, orderBy: { updatedAt: "desc" }, take: 1500 }),
    prisma.dailyClosing.findMany({ where: { shopId: shop.id, businessDate: range }, orderBy: { businessDate: "desc" }, take: 1000 }),
    prisma.heatPressRun.findMany({ where: { shopId: shop.id, createdAt: range }, orderBy: { createdAt: "desc" }, take: 3000 }),
    prisma.heatPressEvent.findMany({ where: { shopId: shop.id, type: "REWORK_REQUIRED", createdAt: range }, select: { heatPressRunId: true }, take: 3000 }),
    prisma.user.findMany({ where: { shopId: shop.id, isActive: true }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }),
    prisma.customerProductionRequest.findMany({ where: { shopId: shop.id, createdAt: range }, select: { id: true, status: true }, take: 3000 }),
    listCompletedOrderTimings(shop.id, start, end),
  ]);

  const paymentTotals = paymentMethodTotals(periodPayments);
  const sales = periodOrders.reduce((sum, order) => sum + money(order.totalAmount), 0);
  const outstandingOrders = currentOrders
    .map((order) => ({ order, balance: outstandingOrderBalance(order) }))
    .filter((row) => row.balance > 0.005);
  const outstandingOrderTotal = outstandingOrders.reduce((sum, row) => sum + row.balance, 0);
  const customerBalances = currentDebts
    .map((debt) => ({ debt, balance: Math.max(0, money(debt.principalAmount) - money(debt.paidAmount)) }))
    .filter((row) => row.balance > 0.005);
  const customerBalanceTotal = customerBalances.reduce((sum, row) => sum + row.balance, 0);
  const supplierMap = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));
  const supplierBalanceMap = new Map<string, number>();
  for (const entry of supplierEntries) supplierBalanceMap.set(entry.supplierId, (supplierBalanceMap.get(entry.supplierId) ?? 0) + money(entry.amount));
  const supplierBalances = [...supplierBalanceMap.entries()]
    .map(([supplierId, balance]) => ({ supplierId, supplierName: supplierMap.get(supplierId) ?? "Supplier", balance }))
    .filter((row) => Math.abs(row.balance) > 0.005)
    .sort((a, b) => b.balance - a.balance);
  const supplierBalanceTotal = supplierBalances.reduce((sum, row) => sum + row.balance, 0);

  const itemMap = new Map(inventoryItems.map((item) => [item.id, item]));
  let vinylUsedMetres = 0;
  let vinylWasteMetres = 0;
  let vinylUsedCost = 0;
  let vinylWasteCost = 0;
  for (const movement of inventoryMovements) {
    const item = itemMap.get(movement.inventoryItemId);
    if (!item || item.kind !== ProductionInventoryKind.VINYL) continue;
    const moved = Math.abs(money(movement.quantityDelta));
    const cost = moved * money(movement.unitCostSnapshot);
    if (movement.type === ProductionInventoryMovementType.PRODUCTION_USE) {
      vinylUsedMetres += moved;
      vinylUsedCost += cost;
    }
    if (movement.type === ProductionInventoryMovementType.WASTE) {
      vinylWasteMetres += moved;
      vinylWasteCost += cost;
    }
  }
  const usedAreaMm2 = costSnapshots.reduce((sum, cost) => sum + money(cost.materialUsedAreaMm2), 0);
  const garmentItems = inventoryItems.filter((item) => item.kind === ProductionInventoryKind.GARMENT);
  const garmentPieces = garmentItems.reduce((sum, item) => sum + money(item.quantity), 0);
  const garmentStockValue = garmentItems.reduce((sum, item) => sum + money(item.quantity) * money(item.unitCost), 0);
  const lowGarmentRows = garmentItems.filter((item) => money(item.quantity) <= money(item.lowStockLevel));

  const designIds = [...new Set(costSnapshots.map((cost) => cost.designJobId))];
  const costOrderIds = [...new Set(costSnapshots.flatMap((cost) => cost.orderId ? [cost.orderId] : []))];
  const [designs, costOrders] = await Promise.all([
    designIds.length ? prisma.designJob.findMany({ where: { shopId: shop.id, id: { in: designIds } }, select: { id: true, title: true } }) : [],
    costOrderIds.length ? prisma.order.findMany({ where: { shopId: shop.id, id: { in: costOrderIds } }, select: { id: true, receiptNumber: true } }) : [],
  ]);
  const designMap = new Map(designs.map((design) => [design.id, design.title]));
  const costOrderMap = new Map(costOrders.map((order) => [order.id, order.receiptNumber]));
  const profitRows = costSnapshots.map((cost) => ({
    cost,
    reconciliation: costSnapshotReconciliation({
      storedTotalCost: cost.totalCost,
      storedProfit: cost.profit,
      revenue: cost.revenue,
      garmentCost: cost.garmentCost,
      materialCost: cost.materialCost,
      wasteCost: cost.wasteCost,
      labourCost: cost.labourCost,
      designCharge: cost.designCharge,
      pressingCharge: cost.pressingCharge,
      additionalServicesCost: cost.additionalServicesCost,
    }),
  }));
  const productionRevenue = profitRows.reduce((sum, row) => sum + money(row.cost.revenue), 0);
  const productionCost = profitRows.reduce((sum, row) => sum + money(row.cost.totalCost), 0);
  const productionProfit = profitRows.reduce((sum, row) => sum + money(row.cost.profit), 0);
  const reconciledJobs = profitRows.filter((row) => row.reconciliation.reconciled).length;

  const expenseTotal = closings.reduce((sum, closing) => sum + money(closing.expenses), 0);
  const refundTotal = closings.reduce((sum, closing) => sum + money(closing.refunds), 0);
  const debtCollections = debtPayments.reduce((sum, payment) => sum + money(payment.amount), 0);
  const liquidPayments = paymentTotals.CASH + paymentTotals.CARD + paymentTotals.MOMO;
  const cashFlow = cashFlowSummary({ paymentInflows: liquidPayments, debtCollections, expenses: expenseTotal, refunds: refundTotal });
  const timing = onTimeSummary(timings);
  const reworkedRunIds = new Set(reworkEvents.map((event) => event.heatPressRunId));
  const rework = reworkSummary({ totalRuns: heatPressRuns.length, reworkedRuns: reworkedRunIds.size });

  const staffRows = staff.map((user) => {
    const processed = periodOrders.filter((order) => order.processedById === user.id);
    const assignedCompleted = timings.filter((row) => row.assignedToId === user.id);
    const assignedOnTime = assignedCompleted.filter((row) => row.dueAt && row.completedAt && row.completedAt <= row.dueAt).length;
    const pressRuns = heatPressRuns.filter((run) => run.createdById === user.id);
    const pressPassed = pressRuns.filter((run) => Boolean(run.qualityPassedAt)).length;
    return {
      user,
      processedOrders: processed.length,
      processedValue: processed.reduce((sum, order) => sum + money(order.totalAmount), 0),
      assignedCompleted: assignedCompleted.length,
      assignedOnTime,
      pressRuns: pressRuns.length,
      pressPassed,
      score: processed.length + assignedCompleted.length + pressPassed,
    };
  }).filter((row) => row.score > 0).sort((a, b) => b.score - a.score);

  const orderStatusCounts = new Map<string, number>();
  for (const order of periodOrders) orderStatusCounts.set(order.status, (orderStatusCounts.get(order.status) ?? 0) + 1);
  const customStatusCounts = new Map<string, number>();
  for (const request of customRequests) customStatusCounts.set(request.status, (customStatusCounts.get(request.status) ?? 0) + 1);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">Financial and operational truth</p>
          <h1 className="mt-1 text-3xl font-black">Management reports</h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">Sales, payments, balances, production usage, garment stock, true job profit, staff throughput, on-time completion, rework, expenses and cash flow from the same durable records used by daily operations.</p>
        </div>
        <ReportActions from={inputDate(start)} to={inputDate(end)} canDownload={hasRole(session, permissions.reports)} />
      </div>

      <form className="panel grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-sm font-semibold">From<input className="field mt-1" name="from" type="date" defaultValue={inputDate(start)} /></label>
        <label className="text-sm font-semibold">To<input className="field mt-1" name="to" type="date" defaultValue={inputDate(end)} /></label>
        <button className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white" type="submit">Apply range</button>
      </form>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="panel p-4"><TrendingUp size={18} className="text-cyan-700" /><p className="mt-2 text-xs font-bold uppercase text-slate-500">Sales / order value</p><p className="mt-1 text-2xl font-black">{currency(sales, shop.currency)}</p><p className="text-xs text-slate-500">{periodOrders.length} non-cancelled orders created in range</p></div>
        <div className="panel p-4"><WalletCards size={18} className="text-emerald-700" /><p className="mt-2 text-xs font-bold uppercase text-slate-500">Recognized payments</p><p className="mt-1 text-2xl font-black">{currency(paymentTotals.total, shop.currency)}</p><p className="text-xs text-slate-500">Successful payments + store credit usage</p></div>
        <div className="panel p-4"><AlertTriangle size={18} className="text-orange-700" /><p className="mt-2 text-xs font-bold uppercase text-slate-500">Outstanding order balances</p><p className="mt-1 text-2xl font-black">{currency(outstandingOrderTotal, shop.currency)}</p><p className="text-xs text-slate-500">{outstandingOrders.length} orders still unpaid</p></div>
        <div className="panel p-4"><Banknote size={18} className={cashFlow.net >= 0 ? "text-emerald-700" : "text-red-700"} /><p className="mt-2 text-xs font-bold uppercase text-slate-500">Net cash flow</p><p className="mt-1 text-2xl font-black">{currency(cashFlow.net, shop.currency)}</p><p className="text-xs text-slate-500">Liquid payments + debt collections − closing expenses/refunds</p></div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-4 sm:p-5"><h2 className="flex items-center gap-2 text-lg font-bold"><WalletCards size={18} /> Payment methods</h2></div>
          <div className="grid grid-cols-2 gap-3 p-4 sm:p-5"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs uppercase text-slate-500">Cash</p><p className="font-black">{currency(paymentTotals.CASH, shop.currency)}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs uppercase text-slate-500">Card</p><p className="font-black">{currency(paymentTotals.CARD, shop.currency)}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs uppercase text-slate-500">Mobile money</p><p className="font-black">{currency(paymentTotals.MOMO, shop.currency)}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs uppercase text-slate-500">Store credit</p><p className="font-black">{currency(paymentTotals.STORE_CREDIT, shop.currency)}</p></div></div>
        </div>
        <div className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-4 sm:p-5"><h2 className="flex items-center gap-2 text-lg font-bold"><Banknote size={18} /> Expenses & cash flow</h2></div>
          <div className="grid grid-cols-2 gap-3 p-4 sm:p-5"><div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs uppercase text-emerald-700">Liquid payment inflow</p><p className="font-black">{currency(liquidPayments, shop.currency)}</p></div><div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs uppercase text-emerald-700">Debt collections</p><p className="font-black">{currency(debtCollections, shop.currency)}</p></div><div className="rounded-xl bg-red-50 p-3"><p className="text-xs uppercase text-red-700">Closing expenses</p><p className="font-black">{currency(expenseTotal, shop.currency)}</p></div><div className="rounded-xl bg-red-50 p-3"><p className="text-xs uppercase text-red-700">Refund outflow</p><p className="font-black">{currency(refundTotal, shop.currency)}</p></div></div>
          <p className="px-4 pb-4 text-xs text-slate-500 sm:px-5 sm:pb-5">Expense reporting is based on daily closings entered during the selected range; {closings.length} closing day(s) contribute expense/refund data.</p>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-4 sm:p-5"><h2 className="text-lg font-bold">Customer & outstanding balances</h2><p className="mt-1 text-xs text-slate-500">Order balances and formal debt balances are shown separately to avoid double-counting.</p></div>
          <div className="grid grid-cols-2 gap-3 p-4 sm:p-5"><div className="rounded-xl bg-orange-50 p-3"><p className="text-xs uppercase text-orange-700">Unpaid order value</p><p className="font-black">{currency(outstandingOrderTotal, shop.currency)}</p></div><div className="rounded-xl bg-red-50 p-3"><p className="text-xs uppercase text-red-700">Customer debt ledger</p><p className="font-black">{currency(customerBalanceTotal, shop.currency)}</p></div></div>
          <div className="max-h-72 divide-y divide-[#ded8cd] overflow-y-auto border-t border-[#ded8cd]">{customerBalances.slice(0, 20).map(({ debt, balance }) => <div key={debt.id} className="flex items-center justify-between gap-3 p-3 text-sm"><div><p className="font-semibold">{debt.customer.name}</p><p className="text-xs text-slate-500">Due {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(debt.dueDate)} · {titleCase(debt.status)}</p></div><strong>{currency(balance, shop.currency)}</strong></div>)}{!customerBalances.length ? <p className="p-4 text-sm text-slate-500">No open customer debt balance.</p> : null}</div>
        </div>
        <div className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-4 sm:p-5"><h2 className="text-lg font-bold">Supplier balances</h2><p className="mt-1 text-xs text-slate-500">Signed Phase 14 supplier-account entries: purchases less payments and return credits.</p></div>
          <div className="p-4 sm:p-5"><p className="text-xs uppercase text-slate-500">Net supplier balance</p><p className="text-2xl font-black">{currency(supplierBalanceTotal, shop.currency)}</p></div>
          <div className="max-h-72 divide-y divide-[#ded8cd] overflow-y-auto border-t border-[#ded8cd]">{supplierBalances.slice(0, 20).map((row) => <div key={row.supplierId} className="flex items-center justify-between gap-3 p-3 text-sm"><span className="font-semibold">{row.supplierName}</span><strong className={row.balance > 0 ? "text-orange-700" : "text-emerald-700"}>{currency(row.balance, shop.currency)}</strong></div>)}{!supplierBalances.length ? <p className="p-4 text-sm text-slate-500">No supplier balance is currently outstanding.</p> : null}</div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="panel p-4"><Factory size={18} className="text-cyan-700" /><p className="mt-2 text-xs font-bold uppercase text-slate-500">Production orders</p><p className="mt-1 text-2xl font-black">{(orderStatusCounts.get("PENDING") ?? 0) + (orderStatusCounts.get("IN_PRODUCTION") ?? 0) + (orderStatusCounts.get("READY") ?? 0)}</p><p className="text-xs text-slate-500">Pending + in production + ready in selected range</p></div>
        <div className="panel p-4"><Scissors size={18} className="text-cyan-700" /><p className="mt-2 text-xs font-bold uppercase text-slate-500">Vinyl used</p><p className="mt-1 text-2xl font-black">{quantity(vinylUsedMetres)} m</p><p className="text-xs text-slate-500">{currency(vinylUsedCost, shop.currency)} · {quantity(usedAreaMm2 / 1_000_000, 2)} m² frozen cut-sheet area</p></div>
        <div className="panel p-4"><AlertTriangle size={18} className="text-orange-700" /><p className="mt-2 text-xs font-bold uppercase text-slate-500">Vinyl waste</p><p className="mt-1 text-2xl font-black">{quantity(vinylWasteMetres)} m</p><p className="text-xs text-slate-500">{currency(vinylWasteCost, shop.currency)} recorded waste cost</p></div>
        <div className="panel p-4"><Shirt size={18} className="text-emerald-700" /><p className="mt-2 text-xs font-bold uppercase text-slate-500">Garment stock</p><p className="mt-1 text-2xl font-black">{quantity(garmentPieces, 0)} pcs</p><p className="text-xs text-slate-500">{currency(garmentStockValue, shop.currency)} value · {lowGarmentRows.length} low-stock rows</p></div>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#ded8cd] p-4 sm:p-5"><div><h2 className="flex items-center gap-2 text-lg font-bold"><TrendingUp size={18} /> Profit per production job</h2><p className="mt-1 text-sm text-slate-600">Each row recomputes cost from garment + material + waste + labour + design + pressing + additional services and compares it with the frozen Phase 14 snapshot.</p></div><div className="flex flex-wrap gap-2"><Badge tone="blue">Revenue {currency(productionRevenue, shop.currency)}</Badge><Badge tone="orange">Cost {currency(productionCost, shop.currency)}</Badge><Badge tone={productionProfit >= 0 ? "green" : "red"}>Profit {currency(productionProfit, shop.currency)}</Badge><Badge tone={reconciledJobs === profitRows.length ? "green" : "red"}>{reconciledJobs}/{profitRows.length} reconciled</Badge></div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Job</th><th className="p-3">Order</th><th className="p-3">Garment</th><th className="p-3">Material</th><th className="p-3">Waste</th><th className="p-3">Labour</th><th className="p-3">Design</th><th className="p-3">Pressing</th><th className="p-3">Extra</th><th className="p-3">Total</th><th className="p-3">Revenue</th><th className="p-3">Profit</th><th className="p-3">Check</th></tr></thead><tbody className="divide-y divide-[#ded8cd]">{profitRows.map(({ cost, reconciliation }) => <tr key={cost.id}><td className="p-3 font-semibold">{designMap.get(cost.designJobId) ?? cost.designJobId}</td><td className="p-3">{cost.orderId ? costOrderMap.get(cost.orderId) ?? cost.orderId : "—"}</td><td className="p-3">{currency(money(cost.garmentCost), shop.currency)}</td><td className="p-3">{currency(money(cost.materialCost), shop.currency)}</td><td className="p-3">{currency(money(cost.wasteCost), shop.currency)}</td><td className="p-3">{currency(money(cost.labourCost), shop.currency)}</td><td className="p-3">{currency(money(cost.designCharge), shop.currency)}</td><td className="p-3">{currency(money(cost.pressingCharge), shop.currency)}</td><td className="p-3">{currency(money(cost.additionalServicesCost), shop.currency)}</td><td className="p-3 font-bold">{currency(money(cost.totalCost), shop.currency)}</td><td className="p-3 font-bold">{currency(money(cost.revenue), shop.currency)}</td><td className={`p-3 font-black ${money(cost.profit) >= 0 ? "text-emerald-700" : "text-red-700"}`}>{currency(money(cost.profit), shop.currency)}</td><td className="p-3"><Badge tone={reconciliation.reconciled ? "green" : "red"}>{reconciliation.reconciled ? "Reconciled" : "Mismatch"}</Badge></td></tr>)}{!profitRows.length ? <tr><td className="p-5 text-slate-500" colSpan={13}>No production cost snapshots were updated in this range.</td></tr> : null}</tbody></table></div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="panel overflow-hidden"><div className="border-b border-[#ded8cd] p-4 sm:p-5"><h2 className="flex items-center gap-2 text-lg font-bold"><Clock3 size={18} /> Jobs completed on time</h2></div><div className="grid grid-cols-3 gap-3 p-4 sm:p-5"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs uppercase text-slate-500">Measured</p><p className="text-xl font-black">{timing.measurable}</p></div><div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs uppercase text-emerald-700">On time</p><p className="text-xl font-black">{timing.onTime}</p></div><div className="rounded-xl bg-orange-50 p-3"><p className="text-xs uppercase text-orange-700">Late</p><p className="text-xl font-black">{timing.late}</p></div></div><p className="px-4 pb-4 text-sm text-slate-600 sm:px-5 sm:pb-5"><strong>{timing.ratePercent.toFixed(1)}%</strong> on-time rate among completed jobs that had a workflow due date.</p></div>
        <div className="panel overflow-hidden"><div className="border-b border-[#ded8cd] p-4 sm:p-5"><h2 className="flex items-center gap-2 text-lg font-bold"><Percent size={18} /> Heat-press rework rate</h2></div><div className="grid grid-cols-3 gap-3 p-4 sm:p-5"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs uppercase text-slate-500">Runs</p><p className="text-xl font-black">{rework.totalRuns}</p></div><div className="rounded-xl bg-orange-50 p-3"><p className="text-xs uppercase text-orange-700">Reworked</p><p className="text-xl font-black">{rework.reworkedRuns}</p></div><div className="rounded-xl bg-cyan-50 p-3"><p className="text-xs uppercase text-cyan-700">Rate</p><p className="text-xl font-black">{rework.ratePercent.toFixed(1)}%</p></div></div><p className="px-4 pb-4 text-sm text-slate-600 sm:px-5 sm:pb-5">A run counts as reworked when a durable REWORK_REQUIRED heat-press event exists in the selected period.</p></div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#ded8cd] p-4 sm:p-5"><h2 className="flex items-center gap-2 text-lg font-bold"><Users size={18} /> Staff productivity</h2><p className="mt-1 text-sm text-slate-600">Operational throughput only: processed orders, completed assigned jobs and heat-press passes. This is not an employee performance score or compensation metric.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Staff</th><th className="p-3">Role</th><th className="p-3">Orders processed</th><th className="p-3">Order value</th><th className="p-3">Assigned jobs completed</th><th className="p-3">On time</th><th className="p-3">Press runs</th><th className="p-3">Press passes</th></tr></thead><tbody className="divide-y divide-[#ded8cd]">{staffRows.map((row) => <tr key={row.user.id}><td className="p-3 font-semibold">{row.user.name}</td><td className="p-3">{titleCase(row.user.role)}</td><td className="p-3">{row.processedOrders}</td><td className="p-3">{currency(row.processedValue, shop.currency)}</td><td className="p-3">{row.assignedCompleted}</td><td className="p-3">{row.assignedOnTime}</td><td className="p-3">{row.pressRuns}</td><td className="p-3">{row.pressPassed}</td></tr>)}{!staffRows.length ? <tr><td className="p-5 text-slate-500" colSpan={8}>No staff throughput was recorded in this range.</td></tr> : null}</tbody></table></div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="panel p-4 sm:p-5"><h2 className="flex items-center gap-2 text-lg font-bold"><PackageCheck size={18} /> Order and production status</h2><div className="mt-4 flex flex-wrap gap-2">{[...orderStatusCounts.entries()].map(([status, count]) => <Badge key={status} tone={status === "COMPLETED" ? "green" : status === "CANCELLED" ? "red" : "blue"}>{titleCase(status)} · {count}</Badge>)}{!orderStatusCounts.size ? <span className="text-sm text-slate-500">No orders in range.</span> : null}</div></div>
        <div className="panel p-4 sm:p-5"><h2 className="flex items-center gap-2 text-lg font-bold"><Boxes size={18} /> Online custom-production status</h2><div className="mt-4 flex flex-wrap gap-2">{[...customStatusCounts.entries()].map(([status, count]) => <Badge key={status} tone={status === "COMPLETED" ? "green" : status === "CANCELLED" ? "red" : "orange"}>{titleCase(status)} · {count}</Badge>)}{!customStatusCounts.size ? <span className="text-sm text-slate-500">No custom-production requests in range.</span> : null}</div></div>
      </section>

      {profitRows.some((row) => !row.reconciliation.reconciled) ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><div className="flex items-center gap-2 font-bold"><AlertTriangle size={17} /> Financial reconciliation warning</div><p className="mt-1">At least one stored production snapshot does not match manual component arithmetic to the cent. Investigate before relying on aggregate profit.</p></div> : <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><div className="flex items-center gap-2 font-bold"><CheckCircle2 size={17} /> Production-cost arithmetic reconciles</div><p className="mt-1">Every production cost snapshot in this range matches garment + material + waste + labour + design + pressing + additional services and stored profit to the cent.</p></div>}
    </div>
  );
}
