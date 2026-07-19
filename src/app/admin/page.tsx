import Link from "next/link";
import { BillingCycle, PlanTier, SubscriptionStatus } from "@prisma/client";
import { Banknote, Megaphone, Plus, Power, Store, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { createGlobalAnnouncementAction, toggleShopAction, updateShopSubscriptionAction } from "@/app/admin/actions";
import { prisma } from "@/lib/db";
import { compactNumber, currency, shortDate } from "@/lib/format";

export default async function AdminPage() {
  const [shops, shopCount, userCount, orderAggregate, debtAggregate, recentLogs] = await Promise.all([
    prisma.shop.findMany({
      include: {
        _count: { select: { users: true, products: true, orders: true, debts: true } },
        orders: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.shop.count(),
    prisma.user.count(),
    prisma.order.aggregate({ _sum: { totalAmount: true }, _count: true }),
    prisma.debt.aggregate({ _sum: { principalAmount: true, paidAmount: true }, _count: true }),
    prisma.auditLog.findMany({ include: { user: true, shop: true }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const openDebt = Number(debtAggregate._sum.principalAmount ?? 0) - Number(debtAggregate._sum.paidAmount ?? 0);
  const recurring = shops.reduce((sum, shop) => {
    if (shop.subscriptionStatus !== "ACTIVE" && shop.subscriptionStatus !== "TRIAL") return sum;
    return sum + Number(shop.billingCycle === "YEARLY" ? Number(shop.yearlyPrice ?? 0) / 12 : shop.monthlyPrice ?? 0);
  }, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Platform control</h1>
          <p className="mt-2 text-sm text-slate-600">Manage tenants, activation status, plans, usage, and global messages.</p>
        </div>
        <Link href="/admin/shops/new" className="inline-flex items-center gap-2 rounded-[8px] bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
          <Plus size={16} /> Create shop
        </Link>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Shops" value={compactNumber(shopCount)} icon={<Store size={20} />} />
        <StatCard label="Users" value={compactNumber(userCount)} />
        <StatCard label="Orders" value={compactNumber(orderAggregate._count)} />
        <StatCard label="Gross sales" value={currency(orderAggregate._sum.totalAmount?.toString() ?? "0")} icon={<TrendingUp size={20} />} />
        <StatCard label="Open debt" value={currency(openDebt)} icon={<Banknote size={20} />} />
        <StatCard label="Monthly recurring" value={currency(recurring)} helper="Estimated MRR from tenant pricing" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-5">
            <h2 className="text-xl font-semibold">Tenant shops</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="bg-[#f6f4ef] text-xs uppercase text-slate-500">
                <tr><th className="p-4">Shop</th><th className="p-4">Plan</th><th className="p-4">Billing</th><th className="p-4">Usage</th><th className="p-4">Storefront</th><th className="p-4">Created</th><th className="p-4">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-[#ded8cd] bg-white">
                {shops.map((shop) => (
                  <tr key={shop.id}>
                    <td className="p-4">
                      <Link className="font-semibold text-slate-950 hover:underline" href={`/admin/shops/${shop.id}`}>{shop.name}</Link>
                      <p className="text-slate-500">/{shop.slug}</p>
                    </td>
                    <td className="p-4">
                      <Badge tone={shop.subscriptionStatus === "ACTIVE" ? "green" : shop.subscriptionStatus === "PAST_DUE" ? "red" : "orange"}>{shop.planTier}</Badge>
                      <p className="mt-1 text-xs text-slate-500">{shop.subscriptionStatus}</p>
                    </td>
                    <td className="p-4">
                      <p>{shop.billingCycle}</p>
                      <p className="text-xs text-slate-500">
                        {shop.billingCycle === "YEARLY" ? currency(shop.yearlyPrice?.toString() ?? "0") : currency(shop.monthlyPrice?.toString() ?? "0")}
                      </p>
                    </td>
                    <td className="p-4">
                      <p>{shop._count.users} users / {shop._count.products} products</p>
                      <p className="text-xs text-slate-500">{shop._count.orders} orders / {shop._count.debts} debts</p>
                    </td>
                    <td className="p-4">
                      <Link className="font-semibold text-[#0f766e] hover:underline" href={`/shop/${shop.slug}`}>Open link</Link>
                      <p className="text-xs text-slate-500">{shop.publicOrderingEnabled ? "Orders on" : "Orders off"}</p>
                    </td>
                    <td className="p-4 text-slate-500">{shortDate(shop.createdAt)}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        <form action={toggleShopAction}>
                          <input type="hidden" name="shopId" value={shop.id} />
                          <Button variant={shop.isActive ? "outline" : "primary"} className="min-h-8 px-2 py-1 text-xs">
                            <Power size={14} />
                            {shop.isActive ? "Suspend" : "Reactivate"}
                          </Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel p-5">
          <div className="mb-4 flex items-center gap-2">
            <Megaphone size={18} className="text-slate-700" />
            <h2 className="text-xl font-semibold">Broadcast</h2>
          </div>
          <form action={createGlobalAnnouncementAction} className="space-y-3">
            <input className="field" name="title" placeholder="Announcement title" required />
            <textarea className="field min-h-28" name="body" placeholder="Message to every shop dashboard" required />
            <Button variant="secondary" className="w-full">Send announcement</Button>
          </form>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="panel p-5">
          <h2 className="text-xl font-semibold">Subscription update</h2>
          <p className="mt-2 text-sm text-slate-500">Change plan, billing cycle, price, renewal date, or payment status.</p>
          <form action={updateShopSubscriptionAction} className="mt-5 space-y-3">
            <select className="field" name="shopId" required>
              <option value="">Select shop</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>{shop.name}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <select className="field" name="planTier" defaultValue={PlanTier.PRO}>
                {Object.values(PlanTier).map((plan) => <option key={plan} value={plan}>{plan}</option>)}
              </select>
              <select className="field" name="billingCycle" defaultValue={BillingCycle.MONTHLY}>
                {Object.values(BillingCycle).map((cycle) => <option key={cycle} value={cycle}>{cycle}</option>)}
              </select>
            </div>
            <select className="field" name="subscriptionStatus" defaultValue={SubscriptionStatus.ACTIVE}>
              {Object.values(SubscriptionStatus).map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <div className="grid grid-cols-3 gap-3">
              <input className="field" name="monthlyPrice" type="number" min="0" step="0.01" placeholder="Monthly" />
              <input className="field" name="yearlyPrice" type="number" min="0" step="0.01" placeholder="Yearly" />
              <input className="field" name="subscriptionRenewalAt" type="date" />
            </div>
            <Button className="w-full">Save subscription</Button>
          </form>
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-5">
            <h2 className="text-xl font-semibold">Recent platform activity</h2>
          </div>
          <div className="divide-y divide-[#ded8cd] bg-white">
            {recentLogs.map((log) => (
              <div key={log.id} className="p-4 text-sm">
                <p className="font-semibold">{log.action}</p>
                <p className="text-slate-500">{log.shop?.name ?? "Platform"} - {log.user?.email ?? "System"} - {shortDate(log.createdAt)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
