import { Boxes, ClipboardList, ShoppingBag, Users } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { SalesChart } from "@/components/reports/sales-chart";
import { currency, shortDate, titleCase } from "@/lib/format";
import { getDashboardMetrics, getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";

function lastSevenDays() {
  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    date.setHours(0, 0, 0, 0);
    return date;
  });
}

export default async function DashboardPage() {
  const { shop } = await getTenantContext();
  if (!shop) return null;

  const metrics = await getDashboardMetrics(shop.id);
  const days = lastSevenDays();
  const salesData = await Promise.all(
    days.map(async (day) => {
      const end = new Date(day);
      end.setDate(day.getDate() + 1);
      const total = await prisma.order.aggregate({
        where: { shopId: shop.id, createdAt: { gte: day, lt: end }, status: { not: "CANCELLED" } },
        _sum: { totalAmount: true },
      });
      return {
        label: day.toLocaleDateString("en", { weekday: "short" }),
        sales: Number(total._sum.totalAmount ?? 0),
      };
    }),
  );

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Today's sales"
          value={currency(metrics.todaySales._sum.totalAmount?.toString() ?? "0", shop.currency)}
          helper={`${metrics.todaySales._count} transaction(s) today`}
          icon={<ShoppingBag size={20} />}
        />
        <StatCard label="Orders pending" value={String(metrics.pendingOrders)} helper="Production and open POS orders" icon={<ClipboardList size={20} />} />
        <StatCard label="Products live" value={String(metrics.products)} helper="Across flexible categories" icon={<Boxes size={20} />} />
        <StatCard label="Active staff" value={String(metrics.activeStaff)} helper="Role-based access enabled" icon={<Users size={20} />} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="panel p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Sales movement</h2>
              <p className="text-sm text-slate-500">Last 7 days, scoped to {shop.name}</p>
            </div>
            <Badge tone="green">Tenant filtered</Badge>
          </div>
          <SalesChart data={salesData} />
        </div>

        <div className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Low stock watch</h2>
            <Badge tone="orange">{metrics.lowStockVariants.length} item(s)</Badge>
          </div>
          <div className="space-y-3">
            {metrics.lowStockVariants.length ? (
              metrics.lowStockVariants.map((variant) => (
                <div key={variant.id} className="flex items-center justify-between rounded-[8px] border border-[#ded8cd] bg-white p-3">
                  <div>
                    <p className="font-semibold">{variant.product.name}</p>
                    <p className="text-sm text-slate-500">{variant.sku}</p>
                  </div>
                  <Badge tone={variant.stockQty === 0 ? "red" : "orange"}>{variant.stockQty} left</Badge>
                </div>
              ))
            ) : (
              <p className="rounded-[8px] bg-white p-4 text-sm text-slate-500">No low-stock items right now.</p>
            )}
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#ded8cd] p-5">
          <h2 className="text-lg font-semibold">Recent orders</h2>
          <p className="text-sm text-slate-500">Cashier, custom order, and online activity land here.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[#f6f4ef] text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Receipt</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Paid</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ded8cd] bg-white">
              {metrics.recentOrders.map((order) => (
                <tr key={order.id}>
                  <td className="px-5 py-3 font-semibold">{order.receiptNumber}</td>
                  <td className="px-5 py-3">{order.customer?.name ?? "Walk-in"}</td>
                  <td className="px-5 py-3">
                    <Badge tone={order.status === "COMPLETED" ? "green" : order.rush ? "red" : "blue"}>{titleCase(order.status)}</Badge>
                  </td>
                  <td className="px-5 py-3">{order.payments.some((payment) => payment.status === "SUCCESS") ? "Yes" : "No"}</td>
                  <td className="px-5 py-3 font-semibold">{currency(order.totalAmount.toString(), shop.currency)}</td>
                  <td className="px-5 py-3 text-slate-500">{shortDate(order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
