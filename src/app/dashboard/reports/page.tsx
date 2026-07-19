import { BarChart3, ReceiptText, ShoppingBag, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { SalesChart } from "@/components/reports/sales-chart";
import { ReportActions } from "@/components/reports/report-actions";
import { prisma } from "@/lib/db";
import { currency } from "@/lib/format";
import { getTenantContext } from "@/lib/tenant";

type Props = {
  searchParams?: Promise<{ range?: string }>;
};

function rangeStart(range = "30") {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - Number(range));
  return date;
}

export default async function ReportsPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const { shop } = await getTenantContext();
  if (!shop) return null;

  const start = rangeStart(params.range ?? "30");
  const [orders, orderItems, variants, staff] = await Promise.all([
    prisma.order.findMany({
      where: { shopId: shop.id, createdAt: { gte: start }, status: { not: "CANCELLED" } },
      include: { processedBy: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.orderItem.findMany({
      where: { order: { shopId: shop.id, createdAt: { gte: start }, status: { not: "CANCELLED" } } },
      include: { productVariant: { include: { product: true } } },
    }),
    prisma.productVariant.findMany({
      where: { product: { shopId: shop.id } },
      include: { product: true },
      orderBy: { stockQty: "asc" },
    }),
    prisma.user.findMany({ where: { shopId: shop.id }, orderBy: { name: "asc" } }),
  ]);

  const revenue = orders.reduce((sum, order) => sum + Number(order.totalAmount), 0);
  const averageOrder = orders.length ? revenue / orders.length : 0;
  const daily = new Map<string, number>();
  orders.forEach((order) => {
    const label = order.createdAt.toLocaleDateString("en", { month: "short", day: "numeric" });
    daily.set(label, (daily.get(label) ?? 0) + Number(order.totalAmount));
  });

  const sellers = new Map<string, { name: string; sku: string; qty: number; revenue: number }>();
  orderItems.forEach((item) => {
    const existing = sellers.get(item.productVariantId) ?? {
      name: item.productVariant.product.name,
      sku: item.productVariant.sku,
      qty: 0,
      revenue: 0,
    };
    existing.qty += item.quantity;
    existing.revenue += Number(item.unitPrice) * item.quantity;
    sellers.set(item.productVariantId, existing);
  });

  const staffSales = new Map<string, { name: string; orders: number; revenue: number }>();
  orders.forEach((order) => {
    const key = order.processedById ?? "unknown";
    const existing = staffSales.get(key) ?? {
      name: order.processedBy?.name ?? "Unassigned",
      orders: 0,
      revenue: 0,
    };
    existing.orders += 1;
    existing.revenue += Number(order.totalAmount);
    staffSales.set(key, existing);
  });

  const csv = [
    "Metric,Value",
    `Revenue,${revenue}`,
    `Orders,${orders.length}`,
    `Average Order,${averageOrder}`,
    `Low Stock,${variants.filter((variant) => variant.stockQty <= variant.product.lowStockThreshold).length}`,
  ].join("\n");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="mt-2 text-sm text-slate-500">Sales, stock, best sellers, and staff performance.</p>
        </div>
        <ReportActions csv={csv} />
      </div>

      <form className="panel flex flex-wrap items-center gap-3 p-4">
        <span className="text-sm font-semibold">Date range</span>
        <select className="field max-w-48" name="range" defaultValue={params.range ?? "30"}>
          <option value="0">Today</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="365">Last year</option>
        </select>
        <button className="rounded-[8px] bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Apply</button>
      </form>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue" value={currency(revenue, shop.currency)} icon={<BarChart3 size={20} />} />
        <StatCard label="Orders" value={String(orders.length)} icon={<ReceiptText size={20} />} />
        <StatCard label="Average order" value={currency(averageOrder, shop.currency)} icon={<ShoppingBag size={20} />} />
        <StatCard label="Staff active" value={String(staff.length)} icon={<Users size={20} />} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="panel p-5">
          <h2 className="text-lg font-semibold">Sales over time</h2>
          <SalesChart data={Array.from(daily.entries()).map(([label, sales]) => ({ label, sales }))} />
        </div>
        <div className="panel p-5">
          <h2 className="text-lg font-semibold">Best sellers</h2>
          <div className="mt-4 space-y-3">
            {Array.from(sellers.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 6).map((item) => (
              <div key={item.sku} className="flex items-center justify-between gap-3 rounded-[8px] bg-white p-3">
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-slate-500">{item.sku} - {item.qty} sold</p>
                </div>
                <p className="font-semibold">{currency(item.revenue, shop.currency)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-5">
            <h2 className="text-lg font-semibold">Stock report</h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f6f4ef] text-xs uppercase text-slate-500">
              <tr><th className="p-3">SKU</th><th className="p-3">Product</th><th className="p-3">Stock</th></tr>
            </thead>
            <tbody className="divide-y divide-[#ded8cd] bg-white">
              {variants.slice(0, 10).map((variant) => (
                <tr key={variant.id}>
                  <td className="p-3 font-semibold">{variant.sku}</td>
                  <td className="p-3">{variant.product.name}</td>
                  <td className="p-3"><Badge tone={variant.stockQty <= variant.product.lowStockThreshold ? "orange" : "green"}>{variant.stockQty}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-5">
            <h2 className="text-lg font-semibold">Staff performance</h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f6f4ef] text-xs uppercase text-slate-500">
              <tr><th className="p-3">Staff</th><th className="p-3">Orders</th><th className="p-3">Revenue</th></tr>
            </thead>
            <tbody className="divide-y divide-[#ded8cd] bg-white">
              {Array.from(staffSales.values()).map((item) => (
                <tr key={item.name}>
                  <td className="p-3 font-semibold">{item.name}</td>
                  <td className="p-3">{item.orders}</td>
                  <td className="p-3">{currency(item.revenue, shop.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
