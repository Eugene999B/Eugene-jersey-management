import Link from "next/link";
import { AlertTriangle, ArrowRight, BarChart3, Boxes, ClipboardList, CreditCard, Palette, ShoppingBag, Users } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { SalesChart } from "@/components/reports/sales-chart";
import { currency, shortDate, titleCase } from "@/lib/format";
import { getDashboardMetrics, getTenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { canSeeNav } from "@/lib/rbac";

function lastSevenDays() {
  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    date.setHours(0, 0, 0, 0);
    return date;
  });
}

type DashboardPageProps = { searchParams?: Promise<{ error?: string; from?: string }> };

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = (await searchParams) ?? {};
  const { session, shop } = await getTenantContext();
  if (!shop) return null;

  const metrics = await getDashboardMetrics(shop.id);
  const visibleNavigation = canSeeNav(session.role);
  const quickActions = [
    { visible: visibleNavigation.pos, href: "/dashboard/pos", label: "Start a sale", note: "Open POS", icon: ShoppingBag },
    { visible: visibleNavigation.orders, href: "/dashboard/orders", label: "Manage production", note: `${metrics.pendingOrders} pending`, icon: ClipboardList },
    { visible: visibleNavigation.designs, href: "/dashboard/designs", label: "Prepare transfer", note: "Artwork and output", icon: Palette },
    { visible: visibleNavigation.reports, href: "/dashboard/reports", label: "Review performance", note: "Sales and stock", icon: BarChart3 },
  ].filter((action) => action.visible);
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
      {params.error === "permission" ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>Access restricted.</strong> Your {titleCase(session.role)} role cannot open {params.from ?? "that page"}. Choose an available area below or ask the owner to update your role.</div> : null}
      <section className="rounded-xl bg-slate-950 p-5 text-white shadow-xl">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Owner operations</p><h1 className="mt-2 text-2xl font-semibold">What needs attention at {shop.name}?</h1><p className="mt-2 text-sm text-slate-300">Start the common work immediately. Detailed controls remain in the navigation.</p></div><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">{titleCase(session.role)}</span></div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => { const Icon = action.icon; return <Link key={action.href} href={action.href} className="group rounded-lg bg-white/10 p-4 transition hover:bg-white/15"><div className="flex items-center justify-between"><Icon size={20} className="text-emerald-300" /><ArrowRight size={16} className="text-white/40 transition group-hover:translate-x-1" /></div><p className="mt-4 font-semibold">{action.label}</p><p className="mt-1 text-xs text-white/55">{action.note}</p></Link>; })}
        </div>
      </section>
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
        <StatCard
          label="Open debt"
          value={currency(Number(metrics.openDebts._sum.principalAmount ?? 0) - Number(metrics.openDebts._sum.paidAmount ?? 0), shop.currency)}
          helper={`${metrics.openDebts._count} active account(s)`}
          icon={<CreditCard size={20} />}
        />
        <StatCard label="Cash holds" value={String(metrics.cashHolds)} helper="Online cash reservations still active" />
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
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Intelligence watch</h2>
              <p className="text-sm text-slate-500">Actionable risks for today</p>
            </div>
            <Badge tone={metrics.overdueDebts ? "red" : "orange"}>{metrics.overdueDebts} overdue</Badge>
          </div>
          <div className="mb-4 grid gap-2">
            <div className="flex items-center gap-3 rounded-[8px] bg-white p-3 text-sm">
              <AlertTriangle size={18} className={metrics.lowStockVariants.length ? "text-orange-600" : "text-emerald-600"} />
              <span>{metrics.lowStockVariants.length} product variant(s) need stock attention.</span>
            </div>
            <div className="flex items-center gap-3 rounded-[8px] bg-white p-3 text-sm">
              <CreditCard size={18} className={metrics.overdueDebts ? "text-red-600" : "text-emerald-600"} />
              <span>{metrics.overdueDebts} overdue debt account(s) need follow-up.</span>
            </div>
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
